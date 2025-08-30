# Use Ubuntu 22.04 (Jammy) with OpenJDK 21 (ARM64 supported)
FROM eclipse-temurin:21-jdk-jammy

# Install Node.js LTS
RUN apt-get update && \
    apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Clojure CLI (tools-deps) - official script method
RUN curl -O https://download.clojure.org/install/linux-install.sh && \
    chmod +x linux-install.sh && \
    ./linux-install.sh && \
    rm linux-install.sh

# Optional: Verify versions
RUN java -version && \
    node --version && \
    npm --version && \
    clojure --version

# Install VS Code dependencies for headless testing
RUN apt-get update && apt-get install -y \
    libglib2.0-dev \
    libgtk-3-0 \
    libgbm-dev \
    libxss1 \
    libasound2 \
    xvfb \
    x11vnc \
    fluxbox \
    libnss3 \
    libatk-bridge2.0-0 \
    libgdk-pixbuf2.0-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libgconf-2-4 \
    libxrandr2 \
    libdrm2 \
    libxkbfile1 \
    libsecret-1-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
