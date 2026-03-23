"""
Execute este script UMA VEZ no seu computador para gerar o token de acesso.
Ele vai abrir o navegador para você autorizar o acesso ao Google Calendar.
"""
import json
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

def main():
    flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
    creds = flow.run_local_server(port=0)

    token_data = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes),
    }

    with open("token.json", "w") as f:
        json.dump(token_data, f, indent=2)

    print("=" * 50)
    print("✅ TOKEN GERADO COM SUCESSO!")
    print("=" * 50)
    print("\nConteúdo do token.json (copie tudo abaixo):\n")
    print(json.dumps(token_data, indent=2))
    print("\n" + "=" * 50)
    print("⬆️  Cole esse conteúdo como secret GOOGLE_TOKEN_JSON no GitHub.")

if __name__ == "__main__":
    main()
