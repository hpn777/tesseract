FROM centos:8

WORKDIR /home/

#ENV http_proxy $http_proxy
#ENV https_proxy $https_proxy
#ENV LD_LIBRARY_PATH /usr/lib64

# RUN yum -y install gcc gcc-c++ make

#RUN yum -y install epel-release boost-devel wget
RUN yum -y install epel-release wget

# RUN yum -y install python-pip
# RUN pip install docker-compose

RUN yum -y install git

RUN curl --silent --location https://rpm.nodesource.com/setup_14.x | bash - \
    && yum -y install nodejs

RUN yum -y install nc