---
title: VS Code Remote Development
description: Using Calva with Remote Development
---

# Using Calva with Remote Development

[VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview) is a new feature in version 1.35 of VS Code that allows a developer to use a container, remote machine, or the Windows Subsystem for Linux (WSL) as a full-featured development environment.

I would recommend reading the [introductory blog post](https://code.visualstudio.com/blogs/2019/05/02/remote-development) and watching the videos. I find the feature extremely exciting and wish more IDEs would implement something like it.

From a Clojure perspective it allows you to have VS Code installed on your Java-less, Clojure-less hardware and still use it to develop Clojure through it.

## A use-case

- For some reason your physical computer has to be running Windows (organizational rules etc.)
- Your deployment environment is Linux
- You want to edit files in an editor running on your physical computer
- Most Clojure tooling is made with *nix first in mind and there are incompatibilities with Windows

## How to

Run *Remote-Containers: Add Development Container Configuration Files...* and pick a suitable Java base image. Then:

### Modify Dockerfile to install Clojure CLI (and optionally lein)

Add:

```Dockerfile
# ...

# Install Clojure - see https://github.com/Quantisan/docker-clojure/blob/master/target/openjdk-14-slim-buster/tools-deps/Dockerfile
ENV CLOJURE_VERSION=1.10.1.619
WORKDIR /tmp
RUN \
apt-get update && \
apt-get install -y curl make rlwrap wget && \
rm -rf /var/lib/apt/lists/* && \
wget https://download.clojure.org/install/linux-install-$CLOJURE_VERSION.sh && \
sha256sum linux-install-$CLOJURE_VERSION.sh && \
echo "28b1652686426cdf856f83551b8ca01ff949b03bc9a533d270204d6511a8ca9d *linux-install-$CLOJURE_VERSION.sh" | sha256sum -c - && \
chmod +x linux-install-$CLOJURE_VERSION.sh && \
./linux-install-$CLOJURE_VERSION.sh
RUN \
su vscode -c "clojure -e '(clojure-version)'" && \
rm ./linux-install-$CLOJURE_VERSION.sh

# Install Lein
RUN \
wget https://raw.githubusercontent.com/technomancy/leiningen/stable/bin/lein -O /bin/lein && \
chmod uog+x /bin/lein
RUN su vscode -c "/bin/lein"

# Cleanup
RUN apt-get purge -y --auto-remove curl wget

# ...
```


### Modify devcontainer.json

Add Calva and, optionally, forward some ports to the host::

```json
"extensions": ["betterthantomorrow.calva"],
"forwardPorts": [8088, 52162], // example: your webapp, your nREPL
```

### Build and start

Run *Remote-Containers: Rebuild and Reopen in container*

## WSL

See [Using Calva with WSL](wsl.md)
