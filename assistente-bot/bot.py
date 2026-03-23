import os
import json
import logging
import pytz
import httpx
import asyncio
from datetime import datetime, timedelta, time
from dotenv import load_dotenv

import google.generativeai as genai
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler
from telegram.constants import ParseMode

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

import notion_helper

# Carregar variáveis de ambiente
load_dotenv()

# Configurações
TOKEN = os.getenv("TELEGRAM_TOKEN", "8737100435:AAEWBx1ZcUyO241Va1TTwQ6MNs3Kli1BO88")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "6346617549")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://fdqnhntgqvragifackuv.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkcW5obnRncXZyYWdpZmFja3V2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzYxOTI0NCwiZXhwIjoyMDg5MTk1MjQ0fQ.3boirmPTwXlHq9ygYlTjM_eqG9XHRwh-hnAGPFv6Z3g")
# O ID do usuário no Supabase (UUID)
USER_ID = os.getenv("SUPABASE_USER_ID", "17695f84-688c-4936-94ec-5a4a571a3b31") 

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyDjZc3sSIkZNfTalobeUL15saSESTcRMR0")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

TIMEZONE = pytz.timezone("America/Sao_Paulo")

# Configurações Apps Script (Automações)
APPS_SCRIPT_URL = os.getenv("APPS_SCRIPT_URL")
APPS_SCRIPT_SECRET = os.getenv("APPS_SCRIPT_SECRET")

# Logging
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)

# --- CLIENTES API REST SUPABASE ASSÍNCRONOS ---
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

async def supabase_get(table, params):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=HEADERS, params=params, timeout=10.0)
        response.raise_for_status()
        return response.json()

async def supabase_post(table, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {**HEADERS, "Prefer": "return=representation"}
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=data, timeout=10.0)
        response.raise_for_status()
        return response.json()

async def supabase_delete(table, params):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    async with httpx.AsyncClient() as client:
        response = await client.delete(url, headers=HEADERS, params=params, timeout=10.0)
        response.raise_for_status()
        return None

async def supabase_upsert(table, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {**HEADERS, "Prefer": "resolution=merge-duplicates,return=representation"}
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=data, timeout=10.0)
        response.raise_for_status()
        return response.json()

async def execute_google_api_call(func):
    """Executa chamadas bloqueantes da API do Google numa thread separada para não travar o loop assíncrono."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, func)

def get_calendar_service():
    token_json = os.getenv("GOOGLE_TOKEN_JSON")
    if not token_json:
        if os.path.exists("token.json"):
            with open("token.json", "r") as f:
                token_info = json.load(f)
        else:
            return None
    else:
        token_info = json.loads(token_json)
        
    creds = Credentials(
        token=token_info.get("token"),
        refresh_token=token_info.get("refresh_token"),
        token_uri=token_info.get("token_uri"),
        client_id=token_info.get("client_id"),
        client_secret=token_info.get("client_secret"),
        scopes=token_info.get("scopes"),
    )
    return build("calendar", "v3", credentials=creds)

# --- AUXILIARES ---
def get_today_key():
    return datetime.now(TIMEZONE).strftime("%Y-%m-%d")

# --- TRATAMENTO GLOBAL DE ERROS ---
async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE):
    """Log the error and send a message to notify the user."""
    logging.error("Exceção não tratada ao processar requisição:", exc_info=context.error)
    try:
        if isinstance(update, Update) and update.effective_message:
            await update.effective_message.reply_text(
                "🚨 Ops! Ocorreu um erro interno ao processar sua ação. "
                "Isso já foi registrado para análise."
            )
    except Exception as e:
        logging.error(f"Erro no próprio handler de erro: {e}")

# --- COMANDOS ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome = (
        "👋 <b>Olá! Eu sou seu Assistente Pessoal.</b>\n\n"
        "Estou aqui para ajudar com sua agenda e seus hábitos.\n\n"
        "<b>Comandos disponíveis:</b>\n"
        "/habitos - Ver e marcar hábitos de hoje\n"
        "/agenda - Ver compromissos de amanhã\n"
        "/hoje - Ver compromissos de hoje\n"
        "/journal - Processar fotos do diário físico\n"
        "/fichas - Processar PDFs das fichas de membros\n"
        "/finalizar - Finalizar o dia no App\n"
        "/help - Ver o que eu posso entender"
    )
    await update.message.reply_html(welcome)

async def list_habits(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not USER_ID:
        await update.message.reply_text("⚠️ USER_ID não configurado.")
        return

    today = get_today_key()
    
    # Busca hábitos assíncrona
    habits_data = await supabase_get("habits", {"user_id": f"eq.{USER_ID}"})
    # Busca conclusões de hoje assíncrona
    comp_data = await supabase_get("habit_completions", {"select": "habit_id", "user_id": f"eq.{USER_ID}", "completed_date": f"eq.{today}"})
    
    done_ids = [c["habit_id"] for c in comp_data]
    
    if not habits_data:
        await update.message.reply_text("🌱 Você ainda não tem hábitos criados no App.")
        return

    text = f"📝 <b>Hábitos de Hoje ({datetime.now(TIMEZONE).strftime('%d/%m')})</b>\n\n"
    keyboard = []
    
    for h in habits_data:
        is_done = h["id"] in done_ids
        status = "✅" if is_done else "⬜"
        text += f"{status} {h['emoji']} {h['name']}\n"
        
        btn_text = f"{'Desmarcar' if is_done else 'Concluir'} {h['name']}"
        callback_data = f"toggle_{h['id']}_{'undo' if is_done else 'do'}"
        keyboard.append([InlineKeyboardButton(btn_text, callback_data=callback_data)])

    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_html(text, reply_markup=reply_markup)

async def toggle_habit_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    _, habit_id, action = query.data.split("_")
    today = get_today_key()
    
    if action == "do":
        h_res = await supabase_get("habits", {"select": "xp", "id": f"eq.{habit_id}"})
        xp = h_res[0].get("xp", 10) if h_res else 10
        
        await supabase_post("habit_completions", {
            "habit_id": habit_id,
            "user_id": USER_ID,
            "completed_date": today,
            "xp_earned": xp
        })
    else:
        await supabase_delete("habit_completions", {"habit_id": f"eq.{habit_id}", "completed_date": f"eq.{today}"})

    await query.edit_message_text("Atualizando... use /habitos para ver o novo estado.")

async def show_agenda(update: Update, context: ContextTypes.DEFAULT_TYPE, day_offset=1):
    service = get_calendar_service()
    if not service:
        await update.message.reply_text("❌ Erro ao conectar com Google Calendar.")
        return

    target_date = (datetime.now(TIMEZONE) + timedelta(days=day_offset))
    start_of_day = TIMEZONE.localize(datetime.combine(target_date.date(), datetime.min.time()))
    end_of_day = TIMEZONE.localize(datetime.combine(target_date.date(), datetime.max.time()))

    events_result = await execute_google_api_call(
        lambda: service.events().list(
            calendarId="primary",
            timeMin=start_of_day.isoformat(),
            timeMax=end_of_day.isoformat(),
            singleEvents=True,
            orderBy="startTime"
        ).execute()
    )

    events = events_result.get("items", [])
    date_str = target_date.strftime("%d/%m")
    day_label = "Amanhã" if day_offset == 1 else "Hoje"
    
    if not events:
        await update.message.reply_html(f"📅 <b>{day_label} ({date_str}):</b>\nNenhum compromisso marcado.")
        return

    msg = f"📅 <b>{day_label} ({date_str}):</b>\n"
    for e in events:
        start_time = e['start'].get('dateTime', e['start'].get('date'))
        time_str = "Dia todo"
        if 'T' in start_time:
            time_str = datetime.fromisoformat(start_time).astimezone(TIMEZONE).strftime("%H:%M")
        msg += f"• <code>{time_str}</code>: {e.get('summary', 'Sem título')}\n"
    
    await update.message.reply_html(msg)

async def finalize_day_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    today = get_today_key()
    
    habits_data = await supabase_get("habits", {"user_id": f"eq.{USER_ID}"})
    comp_data = await supabase_get("habit_completions", {"user_id": f"eq.{USER_ID}", "completed_date": f"eq.{today}"})
    
    habits_on_day = []
    for h in habits_data:
        if not h.get("created_at"):
            habits_on_day.append(h)
            continue
        try:
            dt_utc = datetime.fromisoformat(h["created_at"].replace("Z", "+00:00"))
            dt_local = dt_utc.astimezone(TIMEZONE).strftime("%Y-%m-%d")
            if dt_local <= today:
                habits_on_day.append(h)
        except Exception:
            habits_on_day.append(h)
    
    total_xp = sum(h.get("xp", 10) for h in habits_on_day)
    done_xp = sum(c.get("xp_earned", 0) for c in comp_data)
    done_count = len(comp_data)
    total_count = len(habits_on_day)
    
    await supabase_upsert("daily_summaries", {
        "user_id": USER_ID,
        "summary_date": today,
        "completed_xp": done_xp,
        "total_xp": total_xp,
        "habits_done": done_count,
        "habits_total": total_count
    })
    
    perc = (done_xp / total_xp * 100) if total_xp > 0 else 0
    await update.message.reply_html(f"🏁 <b>Dia Finalizado!</b>\n\nProgresso: {perc:.1f}%\nXP: {done_xp}/{total_xp}\n\nÓtimo trabalho! 🚀")

# --- CHAMADAS PARA O GOOGLE APPS SCRIPT ---
async def run_google_automation(update: Update, context: ContextTypes.DEFAULT_TYPE, action: str):
    if not APPS_SCRIPT_URL:
        await update.message.reply_text("⚠️ URL do Apps Script não configurada no .env.")
        return

    msg_map = {
        "journal": "✍️ Iniciando o processamento do seu <b>Journal</b> físico. Vou ler as fotos e marcar na sua agenda...",
        "fichas": "📋 Iniciando o processamento das <b>Fichas de Membros</b>. Vou ler os PDFs e preencher a planilha..."
    }
    
    status_msg = await update.message.reply_html(msg_map.get(action, "🔄 Processando..."))
    
    try:
        async with httpx.AsyncClient() as client:
            payload = {
                "apiKey": APPS_SCRIPT_SECRET,
                "acao": action
            }
            # O Apps Script Web App exige redirecionamentos (follow_redirects=True)
            response = await client.post(APPS_SCRIPT_URL, json=payload, follow_redirects=True, timeout=60.0)
            
            if response.status_code == 200:
                await status_msg.edit_text(f"✅ <b>Finalizado!</b>\nO Google retornou: {response.text}", parse_mode=ParseMode.HTML)
            else:
                await status_msg.edit_text(f"❌ Erro no servidor: {response.status_code}\n{response.text}")
                
    except Exception as e:
        await status_msg.edit_text(f"🚨 Erro ao falar com o Google: {e}")

async def journal_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await run_google_automation(update, context, "journal")

async def fichas_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await run_google_automation(update, context, "fichas")

async def create_event_with_gemini(text: str):
    if not GEMINI_API_KEY:
        print("GEMINI_API_KEY não encontrada.")
        return None
        
    now = datetime.now(TIMEZONE)
    prompt = f"""
    Eu, Marcelo, quero criar um compromisso na minha agenda do Google. 
    A minha frase foi: "{text}"
    
    Hoje é dia {now.strftime('%d/%m/%Y, %A')}. O horário agora é {now.strftime('%H:%M')}.
    Ano atual: {now.year}. 
    
    Extraia as informações e me devolva ESTRITAMENTE um bloco de código JSON assim:
    ```json
    {{
      "title": "O título do compromisso",
      "start": "AAAA-MM-DDTHH:MM:SS",
      "end": "AAAA-MM-DDTHH:MM:SS"
    }}
    ```
    
    Regras essenciais:
    - Se eu disser "amanhã", você soma 1 dia à data de hoje. 
    - Se eu não disser uma hora, coloque o início às 09:00:00.
    - O "end" (fim) deve ser 1 hora após o início, caso eu não forneça o fim explícito.
    """
    
    try:
        model = genai.GenerativeModel("gemini-1.5-flash-latest")
        response = model.generate_content(prompt)
        content_raw = response.text
        print(f"RESPOSTA PURA DO GEMINI:\n{content_raw}")
        
        # Limpar o código Markdown com '```json'
        content = content_raw.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        content = content.strip()    
        data = json.loads(content)
        return data
    except Exception as e:
        print("Erro no Gemini (Parse ou API):", e)
        return None

async def process_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    
    if text.startswith("/"): return
    
    # Verificar se é um vídeo do YouTube
    video_id = await notion_helper.get_video_id(text)
    if video_id:
        url, custom_desc = await notion_helper.extract_url_and_text(text)
        status_msg = await update.message.reply_text("🎬 Vídeo detectado! Processando informações e gerando resumo (isso pode levar alguns segundos)...")
        
        # Obter metadados usando a url purificada
        metadata = await notion_helper.get_video_metadata(url)
        title = metadata["title"] if metadata else "Vídeo do YouTube"
        thumb = metadata["thumbnail"] if metadata else ""
        
        # Obter transcrição e resumir
        transcript = await notion_helper.get_video_transcript(video_id)
        page_content = await notion_helper.summarize_video(title, transcript)
        
        # Adicionar ao Notion (titulo, url pura, cover, descrição da msg, resumo na pagina)
        success, notion_msg = await notion_helper.add_to_notion(title, url, thumb, custom_desc, page_content)
        
        if success:
            await status_msg.edit_text(f"✅ <b>Adicionado ao Notion (Resources)!</b>\n\n📌 <b>{title}</b>\n\n<i>Resumo salvo dentro da página do Notion com sucesso.</i>", parse_mode=ParseMode.HTML)
        else:
            await status_msg.edit_text(f"❌ Erro ao adicionar ao Notion: {notion_msg}")
        return

    if text.lower() == "ajuda" or "menu" in text.lower():
        await start(update, context)
        return
        
    if "marcar" in text.lower() or "agenda" in text.lower() or "lembrar" in text.lower() or "evento" in text.lower():
        if not GEMINI_API_KEY:
            await update.message.reply_html("🧠 Preciso de uma Chave do <b>Gemini (GEMINI_API_KEY)</b> na nuvem para decifrar as suas mensagens. Por enquanto use a agenda normal.")
            return
            
        msg = await update.message.reply_text("🤔 Analisando e marcando na sua agenda...")
        event_dict = await create_event_with_gemini(text)
        
        if event_dict and "start" in event_dict:
            service = get_calendar_service()
            if service:
                event = {
                  'summary': event_dict.get('title', 'Compromisso'),
                  'start': {
                    'dateTime': event_dict['start'],
                    'timeZone': 'America/Sao_Paulo',
                  },
                  'end': {
                    'dateTime': event_dict['end'],
                    'timeZone': 'America/Sao_Paulo',
                  },
                }
                
                try:
                    event_created = await execute_google_api_call(
                        lambda: service.events().insert(calendarId='primary', body=event).execute()
                    )
                    start_formatted = datetime.fromisoformat(event_dict['start']).strftime('%d/%m às %H:%M')
                    await msg.edit_text(f"✅ Feito! Marquei na agenda:\n<b>{event_dict.get('title')}</b>\n🗓️ {start_formatted}", parse_mode=ParseMode.HTML)
                except Exception as e:
                    await msg.edit_text(f"❌ Erro ao criar na agenda Oauth: {e}")
            else:
                await msg.edit_text("❌ Serviço do Google Calendar não autenticado.")
        else:
            await msg.edit_text("😕 Não consegui decifrar a data e horário exato. Pode tentar ser mais claro? (Ex: Marcar médico amanhã às 15h)")
    else:
        await update.message.reply_text("Entendido! Se eu for sua IA, posso responder, mas as funções ainda estão sendo expandidas. Tente '/ajuda' para meus comandos.")

# --- AGENDAMENTOS (JobQueue) ---
async def send_morning_checkin(context: ContextTypes.DEFAULT_TYPE):
    today = get_today_key()
    
    habits_data = await supabase_get("habits", {"user_id": f"eq.{USER_ID}"})
    if not habits_data: return
    
    morning_habits = []
    for h in habits_data:
        if h.get("time_start") and h["time_start"] < "12:00:00":
            morning_habits.append(h)
    
    if not morning_habits:
        return
        
    comp_data = await supabase_get("habit_completions", {"select": "habit_id", "user_id": f"eq.{USER_ID}", "completed_date": f"eq.{today}"})
    done_ids = [c["habit_id"] for c in comp_data]
    
    pending = [h for h in morning_habits if h["id"] not in done_ids]
    
    if not pending:
        msg = "☀️ <b>Meio-dia! Check-in:</b>\nVocê concluiu todos os seus hábitos da manhã! Excelente começo de dia, Marcelo! 🚀"
        await context.bot.send_message(chat_id=CHAT_ID, text=msg, parse_mode=ParseMode.HTML)
        return
        
    text = "☀️ <b>Check-in do Meio-dia!</b>\n\nComo foi sua manhã? Ainda temos hábitos pendentes pro primeiro tempo do dia:\n\n"
    keyboard = []
    
    for h in pending:
        text += f"⬜ {h['emoji']} {h['name']} ({h['time_start'][:5] if h.get('time_start') else 'S/N'})\n"
        btn_text = f"Concluir {h['name']}"
        callback_data = f"toggle_{h['id']}_do"
        keyboard.append([InlineKeyboardButton(btn_text, callback_data=callback_data)])
        
    reply_markup = InlineKeyboardMarkup(keyboard)
    await context.bot.send_message(chat_id=CHAT_ID, text=text, parse_mode=ParseMode.HTML, reply_markup=reply_markup)

async def send_evening_checkin(context: ContextTypes.DEFAULT_TYPE):
    today = get_today_key()
    
    habits_data = await supabase_get("habits", {"user_id": f"eq.{USER_ID}"})
    if not habits_data: return
    
    evening_habits = []
    for h in habits_data:
        if not h.get("time_start") or h["time_start"] >= "12:00:00":
            evening_habits.append(h)
    
    if not evening_habits:
        return
        
    comp_data = await supabase_get("habit_completions", {"select": "habit_id", "user_id": f"eq.{USER_ID}", "completed_date": f"eq.{today}"})
    done_ids = [c["habit_id"] for c in comp_data]
    
    pending = [h for h in evening_habits if h["id"] not in done_ids]
    
    if not pending:
        msg = "🌙 <b>20h! Check-in:</b>\nVocê arrasou! Todos os hábitos da tarde/noite estão concluídos. Hora de relaxar! 🛋️"
        await context.bot.send_message(chat_id=CHAT_ID, text=msg, parse_mode=ParseMode.HTML)
        return
        
    text = "🌙 <b>Check-in das 20h!</b>\n\nO dia está acabando. Aqui estão suas atividades da tarde/noite que ainda faltam ser concluídas:\n\n"
    keyboard = []
    
    for h in pending:
        time_display = h['time_start'][:5] if h.get('time_start') else 'Livre'
        text += f"⬜ {h['emoji']} {h['name']} ({time_display})\n"
        btn_text = f"Concluir {h['name']}"
        callback_data = f"toggle_{h['id']}_do"
        keyboard.append([InlineKeyboardButton(btn_text, callback_data=callback_data)])
        
    reply_markup = InlineKeyboardMarkup(keyboard)
    await context.bot.send_message(chat_id=CHAT_ID, text=text, parse_mode=ParseMode.HTML, reply_markup=reply_markup)

async def auto_finalize_yesterday(context: ContextTypes.DEFAULT_TYPE):
    target_date = datetime.now(TIMEZONE) - timedelta(days=1)
    yesterday = target_date.strftime("%Y-%m-%d")
    
    res_summary = await supabase_get("daily_summaries", {"user_id": f"eq.{USER_ID}", "summary_date": f"eq.{yesterday}"})
    if res_summary:
        return
        
    habits_data = await supabase_get("habits", {"user_id": f"eq.{USER_ID}"})
    comp_data = await supabase_get("habit_completions", {"user_id": f"eq.{USER_ID}", "completed_date": f"eq.{yesterday}"})
    
    habits_on_day = []
    for h in habits_data:
        if not h.get("created_at"):
            habits_on_day.append(h)
            continue
        try:
            dt_utc = datetime.fromisoformat(h["created_at"].replace("Z", "+00:00"))
            dt_local = dt_utc.astimezone(TIMEZONE).strftime("%Y-%m-%d")
            if dt_local <= yesterday:
                habits_on_day.append(h)
        except Exception:
            habits_on_day.append(h)
            
    total_xp = sum(h.get("xp", 10) for h in habits_on_day)
    done_xp = sum(c.get("xp_earned", 0) for c in comp_data)
    done_count = len(comp_data)
    total_count = len(habits_on_day)
    
    await supabase_upsert("daily_summaries", {
        "user_id": USER_ID,
        "summary_date": yesterday,
        "completed_xp": done_xp,
        "total_xp": total_xp,
        "habits_done": done_count,
        "habits_total": total_count
    })

async def send_daily_agenda(context: ContextTypes.DEFAULT_TYPE):
    service = get_calendar_service()
    if not service: return

    target_date = (datetime.now(TIMEZONE) + timedelta(days=1))
    start_of_day = TIMEZONE.localize(datetime.combine(target_date.date(), datetime.min.time()))
    end_window = TIMEZONE.localize(datetime(target_date.year, target_date.month, target_date.day, 14, 0, 0))

    events_result = await execute_google_api_call(
        lambda: service.events().list(
            calendarId="primary",
            timeMin=start_of_day.isoformat(),
            timeMax=end_window.isoformat(),
            singleEvents=True,
            orderBy="startTime"
        ).execute()
    )
    
    events = events_result.get("items", [])
    if not events:
        msg = f"🌙 <b>Boa noite!</b>\nAmanhã você não tem nada antes das 14h. Aproveite! 😌"
    else:
        msg = f"🌙 <b>Boa noite!</b>\nAmanhã você tem {len(events)} compromissos antes das 14h:\n"
        for e in events:
            start_time = e['start'].get('dateTime', "Dia todo")
            if 'T' in start_time:
                start_time = datetime.fromisoformat(start_time).astimezone(TIMEZONE).strftime("%H:%M")
            msg += f"• 🕐 <b>{start_time}</b> — {e.get('summary')}\n"
            
    await context.bot.send_message(chat_id=CHAT_ID, text=msg, parse_mode=ParseMode.HTML)

async def send_weekly_report(context: ContextTypes.DEFAULT_TYPE):
    target_date = datetime.now(TIMEZONE)
    start_date = (target_date - timedelta(days=6)).strftime("%Y-%m-%d")
    end_date = target_date.strftime("%Y-%m-%d")
    
    res_data = await supabase_get("daily_summaries", {"user_id": f"eq.{USER_ID}", "summary_date": f"gte.{start_date}", "summary_date": f"lte.{end_date}"})
    
    if not res_data:
        msg = "📊 <b>Relatório Semanal</b>\n\nNenhum dado de progresso encontrado para esta semana. Vamos focar na próxima! 💪"
    else:
        total_xp = sum(s["total_xp"] for s in res_data)
        done_xp = sum(s["completed_xp"] for s in res_data)
        avg_perc = (done_xp / total_xp * 100) if total_xp > 0 else 0
        
        msg = (
            f"📊 <b>Relatório Semanal (Dom - Sex)</b>\n\n"
            f"🎯 <b>Média de Foco:</b> {avg_perc:.1f}%\n"
            f"✨ <b>Total XP:</b> {done_xp}\n\n"
        )
        
        if avg_perc >= 90:
            msg += "🏆 <b>Status: Lendário!</b> Você arrasou essa semana! Continue assim."
        elif avg_perc >= 70:
            msg += "🔥 <b>Status: Focado!</b> Uma semana muito produtiva. Parabéns!"
        else:
            msg += "🌱 <b>Status: Em evolução.</b> Que tal aumentar o desafio na próxima semana?"

    await context.bot.send_message(chat_id=CHAT_ID, text=msg, parse_mode=ParseMode.HTML)

async def test_20h_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("🔄 Simulando o alerta das 20h...")
    await send_evening_checkin(context)

def main():
    application = Application.builder().token(TOKEN).build()

    # Handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", start))
    application.add_handler(CommandHandler("habitos", list_habits))
    application.add_handler(CommandHandler("h", list_habits))
    application.add_handler(CommandHandler("agenda", lambda u, c: show_agenda(u, c, 1)))
    application.add_handler(CommandHandler("hoje", lambda u, c: show_agenda(u, c, 0)))
    application.add_handler(CommandHandler("journal", journal_command))
    application.add_handler(CommandHandler("fichas", fichas_command))
    application.add_handler(CommandHandler("finalizar", finalize_day_command))
    application.add_handler(CommandHandler("teste20h", test_20h_command))
    application.add_handler(CallbackQueryHandler(toggle_habit_callback, pattern="^toggle_"))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, process_text))

    # Error Handler
    application.add_error_handler(error_handler)

    # Scheduler (nativo JobQueue)
    jq = application.job_queue
    jq.run_daily(send_morning_checkin, time(hour=12, minute=0, tzinfo=TIMEZONE))
    jq.run_daily(send_evening_checkin, time(hour=20, minute=0, tzinfo=TIMEZONE))
    jq.run_daily(send_daily_agenda, time(hour=20, minute=0, tzinfo=TIMEZONE))
    jq.run_daily(send_weekly_report, time(hour=17, minute=0, tzinfo=TIMEZONE), days=(4,))
    
    # Iniciar
    print("Bot rodando com arquitetura Async moderna...")
    application.run_polling()

if __name__ == '__main__':
    # Necessário no Windows para prevenir conflitos do run_in_executor com a ProactorEventLoop
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    main()
