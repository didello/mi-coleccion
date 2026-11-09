# Blender en modo consola (sin interfaz) para generar los modelos 3D de la app.
#   docker build -t mi-coleccion-blender blender
#   docker run --rm -v "${PWD}:/work" mi-coleccion-blender -P blender/gameboy-jukebox/modelo.py
FROM debian:bookworm-slim

ARG BLENDER_SERIE=4.2
ARG BLENDER_VERSION=4.2.3

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl xz-utils \
      libx11-6 libxi6 libxxf86vm1 libxfixes3 libxrender1 libxkbcommon0 \
      libsm6 libice6 libgl1 libegl1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://download.blender.org/release/Blender${BLENDER_SERIE}/blender-${BLENDER_VERSION}-linux-x64.tar.xz" \
      | tar -xJ -C /opt \
    && ln -s "/opt/blender-${BLENDER_VERSION}-linux-x64/blender" /usr/local/bin/blender

WORKDIR /work
ENTRYPOINT ["blender", "-b", "--factory-startup"]
