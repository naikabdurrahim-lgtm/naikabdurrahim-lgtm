PY = .venv/bin/python
OUT = output
.PHONY: all stills score video final silent qa clean

all: stills score video final silent qa

stills:
	$(PY) src/render.py --stills

score:
	$(PY) src/audio.py

video:
	$(PY) src/render.py --out $(OUT)/naik-brand-film-60s-silent.mp4

final: video score
	$(PY) -m src.mux

silent:
	@echo "silent master: $(OUT)/naik-brand-film-60s-silent.mp4"

qa:
	$(PY) src/qa.py

clean:
	rm -f stills/*.png $(OUT)/*.mp4
