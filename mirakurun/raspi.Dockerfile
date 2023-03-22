FROM chinachu/mirakurun:arm64v8-latest

ENV DEBIAN_FRONTEND=noninteractive

ADD ./libarib25 /libarib25
ADD ./recpt1 /recpt1
ADD ./recpt1-patch /recpt1-patch

RUN apt update
RUN apt install -y autoconf build-essential cmake git patch
RUN cd /libarib25 && \
    cmake . && \
    make && \
    make install
RUN cd /recpt1 && \
    patch -p1 < /recpt1-patch/pt1_dev.h.patch
RUN cd /recpt1/recpt1 && \
    ./autogen.sh && \
    ./configure --enable-b25 && \
    make && \
    make install
RUN ln -nfs /usr/local/bin/recpt1 /recpt1/recpt1/recpt1
