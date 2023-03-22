FROM l3tnun/epgstation:master-debian as upstream

FROM archlinux:latest

RUN pacman -Syu --noconfirm
RUN pacman -S --noconfirm nodejs-lts-hydrogen npm ffmpeg linux-firmware intel-media-driver onevpl-intel-gpu

COPY --from=upstream /app /app/
COPY --from=upstream /app/client /app/client/

ENV LIBVA_DRIVER_NAME=iHD

EXPOSE 8888
WORKDIR /app
ENTRYPOINT ["npm"]
CMD ["start"]
