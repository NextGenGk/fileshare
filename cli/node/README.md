# fileshare

Tiny CLI for the FileShare file transfer service.

## Install

    npx fileshare@latest send ./file.zip
    # or
    npm i -g fileshare

Shell one-liner (no Node required):

    curl -fsSL https://project--4c8ff77c-8bf6-4246-93df-89e285939b6e.lovable.app/cli/install.sh | sh

## Usage

    fileshare send <file> [--expires N] [--max-downloads N] [--password X]
    fileshare get  <slug|url> [--password X] [--out PATH]
    fileshare list                 (requires --token or FILESHARE_API_KEY)
    fileshare rm   <slug>
    fileshare login                (saves token to ~/.config/fileshare/config.json)

Override API base with `FILESHARE_API_URL` or `fileshare config set api-url <url>`.
