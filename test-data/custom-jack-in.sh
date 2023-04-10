#!/bin/bash

# Initialize variables
aliases_string=""
cider_nrepl_version=""

# Parse the command-line arguments
while [[ "$#" -gt 0 ]]; do
    case "$1" in
        --aliases)
            aliases_string="$2"
            shift 2
            ;;
        --cider-nrepl-version)
            cider_nrepl_version="$2"
            shift 2
            ;;
        *)
            echo "Unknown parameter: $1"
            exit 1
            ;;
    esac
done

# Split the aliases string into an array using comma as the delimiter
IFS="," read -ra aliases <<< "$aliases_string"

# Process the array and scalar as needed
echo "Aliases:"
for alias in "${aliases[@]}"; do
    echo "$alias"
done

echo "CIDER nREPL version: $cider_nrepl_version"
