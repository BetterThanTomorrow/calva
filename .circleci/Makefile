SHELL := bash

YS_PREFIX := /tmp/yamlscript
YS_BIN := $(YS_PREFIX)/bin
YS_CLI := $(YS_BIN)/ys

export PATH := $(YS_BIN):$(PATH)

CONFIG := config.yml

.DELETE_ON_ERROR:

default: build

build: $(CONFIG)

%.yml: %.ys $(YS_CLI)
	ys --load --yaml --ordered $< > _$@
	mv _$@ $@

$(YS_CLI):
	curl -sS https://yamlscript.org/install | \
	  PREFIX=$(YS_PREFIX) BIN=1 bash

clean:
	$(RM) $(CONFIG) _$(CONFIG)
