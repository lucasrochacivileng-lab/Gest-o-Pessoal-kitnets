# MacroDroid -> Caixa de Entrada Financeira

## Endpoint

```text
POST https://ngtazecajkiescyxlqou.supabase.co/functions/v1/receive-notification
```

Headers:

```text
Authorization: Bearer SEU_TOKEN
Content-Type: application/json
```

O token foi gerado localmente em `.env.macrodroid.local`, que esta ignorado
pelo Git. Nao coloque esse token em commits, capturas de tela ou mensagens.

## Corpo JSON

```json
{
  "package": "com.nu.production",
  "title": "Compra aprovada",
  "text": "Compra de R$ 32,50 aprovada em IFOOD",
  "received_at": "2026-07-14T21:30:00-03:00"
}
```

A funcao tambem aceita `receivedAt` ou `received at`, mas `received_at` e o
formato recomendado.

## Macro sugerida

1. Gatilho: notificacao recebida do aplicativo Nubank.
2. Acao: requisicao HTTP para o endpoint acima.
3. Metodo: POST.
4. Header `Authorization`: `Bearer ` seguido do token local.
5. Header `Content-Type`: `application/json`.
6. Corpo: associe pacote, titulo, texto e data/hora da notificacao aos campos JSON.
7. Restrinja o gatilho ao pacote `com.nu.production` para nao enviar outras notificacoes do celular.

## Comportamento

- Compra, Pix enviado e Pix recebido geram uma movimentacao pendente.
- Valor, tipo e estabelecimento sao extraidos somente por regras do parser.
- Categoria e centro de custo sao sugeridos pelas regras de classificacao do app.
- Notificacoes nao reconhecidas sao preservadas sem criar movimentacao.
- Nada altera o caixa antes da confirmacao em **Financeiro > Caixa de Entrada**.
- Reenvios identicos nao duplicam a movimentacao.

