# Video Library

A lightweight, browser-based video tracker. Organize video links into sections and playlists, and track each video's status.

## Features

- Add videos individually or in bulk.
- Group videos into customizable sections and playlists.
- Organize videos with customizable statuses such as Watching, To watch, Watched, and Rewatch.
- Filter lists by status.
- Export and import your library to back it up or move it between browsers and devices.
- Install as a progressive web app in browsers that support it.

## Run locally

The app is a static site and has no build step or package dependencies. From the project directory, start a local web server:

```sh
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

You can also host the project files on any static web host. Service worker and install support require HTTPS when deployed.

## Data and backups

Your library is stored in this browser's local storage; it is not synced to a server. Clearing browser data or switching browsers may remove or make the library unavailable. To back up or move it, open **Settings**, use **Show export** or load an export file, then use **Import** in the destination browser. Import replaces the current library.
