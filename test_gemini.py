import google.generativeai as genai
import json

genai.configure(api_key='AIzaSyDjZc3sSIkZNfTalobeUL15saSESTcRMR0')
model = genai.GenerativeModel('gemini-1.5-flash')
response = model.generate_content('Me devolva apenas um json { "a": 1 }')
print("TEXTO BRUTO:", repr(response.text))
