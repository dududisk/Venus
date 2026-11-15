# Pesquisa: voz em pt-BR (Etapa 1, passo 1)

Autor: @thimote, em 15/11/2026. Diretriz do dono: custo-benefício. Começar pelo grátis; se for pago, o mais barato do mercado.

Premissa de uso: 60 interações/dia, 10 s de fala e 200 caracteres de resposta cada. Isso dá ~5 h/mês de STT e ~360 mil caracteres/mês de TTS.

## Recomendação

1. **Começo grátis (R$ 0):** STT pelo `SpeechRecognition` com `lang='pt-BR'`, TTS pelo `speechSynthesis` com voz pt-BR, e wake word "Venus" detectada no próprio transcript. O custo é privacidade: a escuta contínua manda o áudio para a nuvem (Google no Chrome; provavelmente Microsoft no Edge, não confirmado).
2. **Testar primeiro no Edge.** Ele tem as vozes neurais pt-BR Francisca e Antonio, "Online (Natural)", de graça. Se o reconhecimento contínuo falhar no Edge, usar o Chrome.
3. **Upgrade mais barato, que ainda fica em US$ 0 nos free tiers:**
   - STT: Groq `whisper-large-v3-turbo` na rota `/stt` do bridge. US$ 0,04/h, ~US$ 0,20/mês.
   - TTS: Azure Neural F0 na rota `/tts`. 0,5 M caracteres/mês grátis.
4. **Quando mudar:** o reconhecimento do navegador cai com frequência; a wake word falha em mais de 1 de cada 10 tentativas; ou o dono quer tirar a escuta contínua do Google/Microsoft.
5. **Remover o `kokoro-js`.** A versão 1.2.1 não tem voz nem fonemizador pt, é ~2,2x mais lenta que tempo real, e removê-lo zera o `npm audit`. Se um dia quisermos TTS local, o candidato é o Piper pt_BR.

## STT

| Opção | Custo | Estimativa/mês | pt-BR | Privacidade | Esforço |
|---|---|---|---|---|---|
| `SpeechRecognition` (Chrome), `pt-BR` | grátis | US$ 0 | boa (interpretação) | áudio vai para servidor | mínimo |
| `SpeechRecognition` on-device | grátis | US$ 0 | Edge só pt-PT, e no Canary; Chrome pt-BR não confirmado | local | baixo, se existir |
| whisper.cpp no bridge | grátis | US$ 0 | razoável (base/small) | local | médio |
| Vosk pt | grátis | US$ 0 | ruim (WER 27–33%) | local | não recomendado |
| **Groq whisper-large-v3-turbo** | US$ 0,04/h (mín. 10 s/req.) | ~US$ 0,20 (free plan provável) | boa | Groq | baixo |
| Deepgram Nova-3 | US$ 0,0052/min; US$ 200 de crédito | ~US$ 1,56 | multilíngue (pt-BR não confirmado) | Deepgram | baixo/médio |
| ElevenLabs Scribe (atual) | US$ 0,20/h (conferir) | ~US$ 1,00 | boa | ElevenLabs | zero |
| Azure STT | F0 5 h/mês grátis | US$ 0–5 | boa | Microsoft | médio |

## TTS

| Opção | Custo | Estimativa/mês | pt-BR | Privacidade | Esforço |
|---|---|---|---|---|---|
| **Edge: Francisca/Antonio (Natural)** | grátis | US$ 0 | ótima | texto vai para a Microsoft | baixo |
| Chrome: Google português do Brasil | grátis | US$ 0 | média | Google | baixo |
| Voz local do Windows | grátis | US$ 0 | robótica | local | baixo |
| Kokoro (`kokoro-js` 1.2.1) | grátis | — | **sem pt** | local | inviável |
| Piper pt_BR (WASM) | grátis | US$ 0 | razoável | local | médio |
| **Azure Neural F0** | 0,5 M caracteres grátis/mês | US$ 0 (acima: ~US$ 15/1 M, não confirmado) | ótima | Microsoft | médio |
| Amazon Polly Neural | US$ 16/1 M; 1 M grátis no 1º ano | US$ 0, depois ~US$ 5,76 | boa | AWS | médio |
| ElevenLabs Flash v2.5 (atual) | US$ 40/1 M | ~US$ 14,40 | ótima | ElevenLabs | zero |

## Wake word

- **Decisão:** detectar "Venus" no transcript do `SpeechRecognition`, de graça, na arquitetura atual.
- **Regex:** normalizar o texto sem acento (NFD) e casar `v[eê]n(u|o)s`, mais as variantes da voz do dono.
- **Cuidado com "vem nos":** é frase comum e daria falso positivo; aceitar só no começo da frase, ou não aceitar.
- **openWakeWord:** só funciona com wake words em inglês. Não vale o esforço agora.

## Pontos no código para a troca

- `src/lib/voice.ts`:
  - `rec.lang = 'en-GB'` fixo.
  - O regex `WAKE` e as listas `CONTINUES`, `STOP` e `OVERRIDE` estão em inglês.
  - **Bug para pt:** `norm()` apaga letras acentuadas e quebra o filtro de eco.
  - No `OVERRIDE`, evitar "para", que também é preposição.
- `src/App.tsx:66`: `NAME`.
- `src/lib/tts.ts`: `candidateVoices()` filtra `/^en/`, `u.lang` cai em `en-GB` e `shape()` trata "sir".
- `bridge/server.mjs`: `/stt` sem `language_code`; `/tts` com uma voz inglesa.
- `src/config.ts`: não há variável de idioma.

## Lacunas (não confirmado)

- Preços pagos do Azure e do Google; o preço do TTS da OpenAI.
- O free tier da ElevenLabs.
- O limite do plano Free da Groq.
- Nomes exatos das vozes no Edge e no Chrome: conferir com `speechSynthesis.getVoices()`.
- pt-BR on-device no Chrome.
- Para onde vai o áudio no Edge.
- Latência do Whisper local e do Piper neste PC.

## Fontes

- https://console.groq.com/docs/speech-to-text
- https://console.groq.com/docs/rate-limits
- https://deepgram.com/pricing
- https://elevenlabs.io/pricing/api
- https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/
- https://aws.amazon.com/polly/pricing/
- https://developer.mozilla.org/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API
- https://learn.microsoft.com/en-us/microsoft-edge/web-platform/speech-recognition-api
- https://readium.org/speech/docs/WebSpeech.html
- https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
- https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_BR
- https://alphacephei.com/vosk/models
- https://home-assistant.io/voice_control/about_wake_word
