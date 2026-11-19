# Bot de sesgo cuantitativo para BTC Up/Down en Polymarket

Réplica del sistema que circula en redes ("momentum de 30 s + sesgo por semivarianza, ~38 operaciones por hora, 334 927 USD en 202 días"), probada con **datos reales**: 2 679 mercados BTC de 15 minutos ya resueltos (22-oct a 19-nov-2026), 1,8 millones de operaciones reales de Polymarket y 2,4 millones de segundos de precio de BTC.

## Veredicto

**La fórmula, por sí sola, no gana dinero después de comisiones con una latencia realista.**

- La señal sí tiene información: rinde entre 4 y 9 puntos de ROI más que apostar al azar en el mismo momento.
- Pero las comisiones de taker (≈3,5 % del monto a precio 0,50) se comen casi todo.
- Las variantes con umbrales que "parecen" ganar (+6 % a +13 %) solo ganan si compras **en el mismo segundo** del movimiento de BTC. Con 3 s de retraso la ventaja cae a ~0 y con 4–6 s desaparece, tanto en el periodo usado para elegir parámetros como en el periodo fuera de muestra.
- Es decir, la ganancia está en la **velocidad** (comprar antes de que los market makers reajusten el precio), no en el momentum ni en la semivarianza. Esa carrera la ganan bots profesionales con infraestructura de baja latencia, no un script que consulta APIs cada segundo, y mucho menos un bot de copy-trading que copia la operación después.

## Cómo funcionan estos mercados (lo que el post no dice)

- Slugs deterministas: `btc-updown-5m-<epoch_inicio>` y `btc-updown-15m-<epoch_inicio>`.
- Resuelven "Up" si la **TWAP de BTC/USD de Chainlink** de la ventana es ≥ al precio del inicio, no el precio final.
- **Comisión de taker**: `acciones × coef × p × (1 − p)`. Coeficiente **0,07** hasta el 20-nov-2026 23:59 UTC y **0,05** después para BTC 5m/15m. A p = 0,50 equivale al 3,5 % (2,5 % desde el 20-nov) del monto apostado.
- Con menos de 200 000 USD de volumen ponderado en 30 días no hay reembolso de comisiones (a partir del 20-nov).

## Resultados (15m, 100 USD por operación, cooldown 90 s, ~26 ops/hora)

Tomando el precio de entrada de las operaciones reales posteriores a la señal y aplicando la comisión vigente. IC95 = intervalo de confianza del PnL total, agrupado por mercado.

### Estrategia tal como se describe (sin umbrales)

| Periodo | Variante | Ops | Acierto | Precio medio | Neto | ROI | IC95 |
|---|---|---|---|---|---|---|---|
| 5–19 nov | señal | 8 539 | 63,0 % | 0,602 | +6 639 | +0,78 % | [−19 612, +32 889] |
| 5–19 nov | lado al azar | 8 679 | 51,0 % | 0,508 | −71 039 | −8,19 % | [−101 422, −40 655] |
| 5–19 nov | lado contrario | 8 566 | 37,1 % | 0,395 | −158 359 | −18,49 % | [−197 390, −119 329] |
| 22 oct–5 nov (fuera de muestra) | señal | 8 610 | 62,7 % | 0,608 | −6 620 | −0,77 % | [−31 016, +17 775] |

Las cifras con latencia de 1 s son optimistas (ver abajo). Con 4 s, la estrategia base da −0,74 % y −2,24 %.

### La ventaja se evapora con la latencia

La Data API marca cada operación **entre 1,0 y 3,0 s después** del match real (mediana 2,2 s, medido con `pmbot.medir_retraso` contra el websocket del CLOB). Por eso, "latencia 1–2 s" en esta tabla equivale a comprar prácticamente en el mismo instante en que se mueve BTC.

Umbrales |momentum| ≥ 0,02 % y |sesgo| ≥ 0,3:

| Latencia | 5–19 nov: precio / neto / ROI | 22 oct–5 nov: precio / neto / ROI |
|---|---|---|
| 1 s | 0,658 / +20 216 / **+6,55 %** ✱ | 0,661 / +27 821 / **+8,46 %** ✱ |
| 2 s | 0,663 / +15 009 / +4,88 % ✱ | 0,668 / +21 870 / +6,67 % ✱ |
| 3 s | 0,671 / +7 892 / +2,59 % | 0,679 / +8 162 / +2,51 % |
| 4 s | 0,678 / +1 702 / +0,56 % | 0,687 / +1 521 / +0,47 % |
| 5 s | 0,680 / +1 053 / +0,35 % | 0,690 / +11 / 0,00 % |
| 6 s | 0,680 / +485 / +0,16 % | 0,691 / −1 197 / −0,37 % |

✱ = IC95 por encima de cero. El acierto se mantiene en ~71 %, pero el precio que pagas sube 2–3 centavos en pocos segundos: el mercado ya descuenta el movimiento.

En la cuadrícula completa (5 umbrales de momentum × 4 de sesgo = 20 combinaciones) con latencia de 4 s: 0 de 20 son significativas en el periodo 5–19 nov y 1 de 20 en el periodo fuera de muestra, lo esperable por azar. Archivos: `results/grid-*.txt` y `results/decay-latencia.txt`.

## Sobre el post

- **Los números no cuadran entre sí.** 334 927 USD ÷ 96 USD por operación = 3 489 operaciones en 202 días, unas 17 al día, no 38 por hora. Con 38 por hora durante 202 días serían ~184 000 operaciones, a ~1,8 USD cada una.
- **Las "mejores operaciones" son billetes de lotería.** 535 → 2 860 USD implica comprar a ~0,19. En el backtest, las entradas de la señal por debajo de 0,20 pierden dinero en ambos periodos (−4 120 y −11 834 USD).
- **Es publicidad.** El objetivo del texto es el enlace de referido a un bot de Telegram de copy-trading. Copiar una estrategia que depende de la velocidad la destruye por definición: cuando copias, el precio ya se movió (la tabla de latencia lo mide). Además, esos bots suelen pedir custodia de fondos o la clave de tu wallet.
- "Varios agentes de IA" / "Grok": la lógica son dos estadísticos de pocas líneas (`pmbot/signals.py`). No hace falta IA.
- No pude verificar la cuenta del trader porque el enlace venía truncado.

## Uso

Solo Python 3.10+ y biblioteca estándar.

```bash
cd polymarket-bot

# tests (incluye uno que verifica que la señal no mira el futuro)
python3 -m unittest discover -s tests

# backtest: descarga y cachea en .cache/ (~5 min la primera vez para 14 días)
python3 -m pmbot.backtest --window 15m --days 14
python3 -m pmbot.backtest --window 15m --days 14 --latency 4 --min-momentum 0.02 --min-skew 0.3

# barrido de umbrales sobre datos cacheados
python3 -m pmbot.grid --days 14 --latency 4

# paper trading en vivo: libro de órdenes real, sin dinero
python3 -m pmbot.paper --window 15m --stake 10 --minutes 120

# medir el retraso match → Data API (requiere: pip install websockets)
python3 -m pmbot.medir_retraso --segundos 180
```

`paper` recorre el libro real (asks del token + 1 − bids del token contrario, porque el motor cruza ambos), cobra la comisión del mercado, liquida con el resultado oficial al cerrar cada ventana y guarda todo en `results/paper-trades.csv`. Tiene `--max-loss` para dejar de abrir posiciones.

### Archivos

| Archivo | Qué hace |
|---|---|
| `pmbot/signals.py` | Momentum 30 s, sesgo por semivarianza y regla de decisión |
| `pmbot/polymarket.py` | Gamma, CLOB y Data API v2 (solo lectura), comisiones, libro efectivo |
| `pmbot/btc.py` | Velas de 1 s de BTCUSDT (espejo público de Binance) |
| `pmbot/backtest.py` | Backtest con controles (al azar, contraria, solo momentum) |
| `pmbot/grid.py` | Barrido de umbrales |
| `pmbot/paper.py` | Paper trading en vivo |
| `pmbot/medir_retraso.py` | Mide el desfase de timestamps de la Data API |
| `results/` | Resúmenes JSON y tablas de las corridas citadas arriba |

## Por qué no hay modo con dinero real

No hay ventaja medible con latencia realista, así que conectarlo a una wallet solo automatizaría pérdidas por comisiones. Si aun así quisieras hacerlo, necesitarías el SDK unificado de Polymarket (colateral pUSD), la clave privada de tu wallet en el servidor, latencia muy baja hacia el CLOB y comprobar que Polymarket está permitido en tu país.

## Limitaciones

- El precio de BTC es el de Binance BTCUSDT, no el stream TWAP de Chainlink. Solo afecta a la señal: el resultado de cada mercado es el oficial.
- El precio de entrada se infiere de operaciones reales, no de un libro histórico completo. Con 100 USD por operación el impacto suele ser pequeño, pero no es cero.
- Son 4 semanas de un solo régimen de mercado y solo ventanas de 15 m (el código soporta `--window 5m`).
