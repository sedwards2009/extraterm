FROM fedora:rawhide
ARG CACHEBUST=no

ADD ./docker_script.sh /
RUN chmod u+x /docker_script.sh
CMD /docker_script.sh
