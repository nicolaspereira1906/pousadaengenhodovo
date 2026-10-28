import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from build import noticia_ok  # noqa: E402

assert noticia_ok("Monte Verde prepara 'Natal nas Montanhas' com atrações itinerantes")
assert noticia_ok("Festival de inverno em Camanducaia tem shows gratuitos")
assert not noticia_ok("Resultado das eleições 2026 em Camanducaia (MG): como foi a votação no 2º turno")
assert not noticia_ok("Mulher é encontrada morta com tiro em casa, em Camanducaia")
assert not noticia_ok("Lula vence em Santa Bárbara do Monte Verde")
assert not noticia_ok("Show em Belo Horizonte")
assert not noticia_ok("Mulher natural de Camanducaia é encontrada esquartejada em São Paulo")
assert not noticia_ok("Informação sobre assalto à agência do Banco do Brasil em Camanducaia")
print("ok")
