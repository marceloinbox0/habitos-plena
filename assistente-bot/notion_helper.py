import os
import re
import httpx
import google.generativeai as genai
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

# Configurações do Notion (Serão lidas do .env ou passadas via variáveis de ambiente)
NOTION_TOKEN = os.getenv("NOTION_TOKEN")
NOTION_DATABASE_ID = os.getenv("NOTION_DATABASE_ID")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

async def get_video_id(url):
    """Extrai o ID do vídeo do YouTube de várias URLs possíveis."""
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
        r'(?:be\/)([0-9A-Za-z_-]{11}).*',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

async def extract_url_and_text(text):
    """Separa a URL do YouTube e qualquer texto extra que o usuário enviou."""
    url_match = re.search(r'(https?://[^\s]+)', text)
    if url_match:
        url = url_match.group(1)
        desc = text.replace(url, '').strip()
        return url, desc
    return text, ""


async def get_video_metadata(url):
    """Busca o título e a thumb usando o oEmbed do YouTube."""
    oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(oembed_url)
            if response.status_code == 200:
                data = response.json()
                return {
                    "title": data.get("title"),
                    "thumbnail": data.get("thumbnail_url")
                }
        except Exception as e:
            print(f"Erro ao buscar metadados: {e}")
    return None

async def get_video_transcript(video_id):
    """Busca a transcrição do vídeo em português ou inglês."""
    try:
        # Tenta pegar em português, depois em inglês
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        try:
            transcript = transcript_list.find_transcript(['pt'])
        except:
            transcript = transcript_list.find_transcript(['en'])
        
        data = transcript.fetch()
        return " ".join([item['text'] for item in data])
    except Exception as e:
        print(f"Não foi possível obter a transcrição: {e}")
        return None

async def summarize_video(title, transcript):
    """Usa o Gemini para resumir o conteúdo do vídeo."""
    if not GEMINI_API_KEY:
        return "Gemini API Key não configurada para resumo."
    
    if not transcript:
        return "Não foi possível obter a transcrição do vídeo para o resumo."

    prompt = f"""
    Resuma o seguinte vídeo do YouTube de forma detalhada e estruturada com tópicos.
    Título: {title}
    Conteúdo (transcrição): {transcript}
    
    O resumo deve ser em Português, destacando os pontos principais de forma muito clara. 
    Esse resumo será adicionado como o conteúdo principal (corpo) de uma página de estudos no Notion.

    """
    
    try:
        model = genai.GenerativeModel("gemini-1.5-flash-latest")
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        return f"Erro ao gerar resumo com Gemini: {e}"

async def add_to_notion(title, url, cover, description, page_content):
    """Adiciona uma nova página ao banco de dados do Notion com o conteúdo no corpo da página."""
    if not NOTION_TOKEN or not NOTION_DATABASE_ID:
        return False, "Notion Token ou Database ID não configurados."

    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }

    payload = {
        "parent": {"database_id": NOTION_DATABASE_ID},
        "properties": {
            "Name": {
                "title": [{"text": {"content": title}}]
            },
            "URL": {
                "url": url
            },
            "Template": {
                "select": {"name": "Video"}
            }
        }
    }

    if cover:
        payload["cover"] = {
            "type": "external",
            "external": {"url": cover}
        }

    if description and description.strip():
        payload["properties"]["Description"] = {
            "rich_text": [{"text": {"content": description[:2000]}}]
        }
        
    if page_content:
        # Notion suporta blocos no children, vamos quebrar o page_content para não estourar o limite de 2000 carac/bloco
        blocks = []
        for chunk in [page_content[i:i+2000] for i in range(0, len(page_content), 2000)]:
            blocks.append({
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"text": {"content": chunk}}]
                }
            })
        payload["children"] = blocks

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post("https://api.notion.com/v1/pages", headers=headers, json=payload)
            if response.status_code == 200:
                return True, "Adicionado ao Notion com sucesso!"
            else:
                return False, f"Erro no Notion: {response.text}"
        except Exception as e:
            return False, f"Erro de conexão com Notion: {e}"
