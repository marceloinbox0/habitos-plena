import os
import json
import requests
from datetime import datetime, timedelta
import pytz
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# ─────────────────────────────────────────────
# CONFIGURAÇÕES
# ─────────────────────────────────────────────
TELEGRAM_TOKEN = "8737100435:AAEWBx1ZcUyO241Va1TTwQ6MNs3Kli1BO88"
TELEGRAM_CHAT_ID = "6346617549"
TIMEZONE = pytz.timezone("America/Sao_Paulo")


def send_telegram(message: str):
    """Envia mensagem pelo Telegram."""
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML"
    }
    response = requests.post(url, json=payload)
    response.raise_for_status()


def get_calendar_service():
    """Autentica e retorna o serviço do Google Calendar."""
    token_data = os.environ.get("GOOGLE_TOKEN_JSON")
    if not token_data:
        raise ValueError("Variável GOOGLE_TOKEN_JSON não encontrada!")

    token_info = json.loads(token_data)
    creds = Credentials(
        token=token_info.get("token"),
        refresh_token=token_info.get("refresh_token"),
        token_uri=token_info.get("token_uri"),
        client_id=token_info.get("client_id"),
        client_secret=token_info.get("client_secret"),
        scopes=token_info.get("scopes"),
    )
    return build("calendar", "v3", credentials=creds)


def get_tomorrow_morning_events():
    """Busca eventos de amanhã que começam antes das 14h."""
    service = get_calendar_service()

    now_local = datetime.now(TIMEZONE)
    tomorrow = now_local.date() + timedelta(days=1)

    # Janela: meia-noite até 14h do dia seguinte
    start_of_day = TIMEZONE.localize(datetime.combine(tomorrow, datetime.min.time()))
    end_window = TIMEZONE.localize(datetime(tomorrow.year, tomorrow.month, tomorrow.day, 14, 0, 0))

    events_result = service.events().list(
        calendarId="primary",
        timeMin=start_of_day.isoformat(),
        timeMax=end_window.isoformat(),
        singleEvents=True,
        orderBy="startTime"
    ).execute()

    return events_result.get("items", []), tomorrow


def format_time(event):
    """Formata o horário de início do evento."""
    start = event["start"]
    if "dateTime" in start:
        dt = datetime.fromisoformat(start["dateTime"])
        dt_local = dt.astimezone(TIMEZONE)
        return dt_local.strftime("%H:%M")
    return "Dia inteiro"


def main():
    try:
        events, tomorrow = get_tomorrow_morning_events()
        date_str = tomorrow.strftime("%d/%m/%Y")
        weekday_map = {
            0: "Segunda-feira", 1: "Terça-feira", 2: "Quarta-feira",
            3: "Quinta-feira", 4: "Sexta-feira", 5: "Sábado", 6: "Domingo"
        }
        weekday = weekday_map[tomorrow.weekday()]

        if not events:
            message = (
                f"🌙 <b>Bom noite!</b>\n\n"
                f"📅 Amanhã é <b>{weekday}, {date_str}</b>\n\n"
                f"✅ Você <b>não tem compromissos</b> antes das 14h.\n"
                f"Pode descansar com tranquilidade! 😌"
            )
        else:
            lines = [
                f"🌙 <b>Boa noite!</b>\n",
                f"📅 Amanhã é <b>{weekday}, {date_str}</b>\n",
                f"⚠️ Você tem <b>{len(events)} compromisso(s)</b> antes das 14h:\n"
            ]
            for event in events:
                name = event.get("summary", "Sem título")
                time = format_time(event)
                lines.append(f"  • 🕐 <b>{time}</b> — {name}")

            lines.append("\nDurma bem e prepare-se! 💪")
            message = "\n".join(lines)

        send_telegram(message)
        print("✅ Mensagem enviada com sucesso!")

    except Exception as e:
        error_msg = f"❌ Erro no Assistente de Agenda:\n\n{str(e)}"
        send_telegram(error_msg)
        raise


if __name__ == "__main__":
    main()
