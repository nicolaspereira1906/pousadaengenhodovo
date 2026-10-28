# Vídeo de abertura (opcional) — Google Flow

O site já abre com as fotos reais da pousada passando em sequência. Se quiser um vídeo de fundo da região,
gere no Google Flow (Veo 3.1 Fast, 8 s, ~20 créditos). Não use IA para mostrar a pousada: só a paisagem.

**Prompt (16:9, sem áudio):**

> Slow cinematic drone shot at sunrise over the Serra da Mantiqueira mountains in southern Minas Gerais, Brazil.
> Layers of green mountains, low mist in the valleys, Araucaria pine trees in the foreground,
> warm golden light, soft clouds. Smooth forward glide, no people, no text, no buildings in close-up,
> realistic, natural colors, 4K documentary look.

Depois:

1. Baixe o MP4 e salve como `assets/video/hero.mp4` (de preferência com menos de 5 MB).
2. Rode `python build.py`. O vídeo entra no lugar das fotos de fundo, em loop e sem som.
