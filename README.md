# Beam

[![GitHub release](https://img.shields.io/github/v/release/TAGISWILD/beam-tv)](https://github.com/TAGISWILD/beam-tv/releases)
[![MIT License](https://img.shields.io/github/license/TAGISWILD/beam-tv)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-3%20passing-brightgreen)](beam-server/test/library.test.js)
[![GitHub stars](https://img.shields.io/github/stars/TAGISWILD/beam-tv?style=social)](https://github.com/TAGISWILD/beam-tv/stargazers)
[![Hacktoberfest](https://img.shields.io/badge/Hacktoberfest-ready-FF7518)](https://github.com/TAGISWILD/beam-tv/issues?q=is%3Aissue+is%3Aopen+label%3Ahacktoberfest)

Beam is an open-source local media player for Samsung Tizen TVs. It browses and
plays video, audio, images, and sidecar subtitles from USB storage and compatible
media servers on the same local network.

The project has two parts:

- **Beam TV:** a remote-friendly Tizen web application.
- **Beam Companion Server:** an optional Electron application that shares folders
  from a Mac or Windows computer over the local network.

Beam has no accounts, cloud service, advertising, analytics, or DRM.

**[Try the browser preview](https://atharvachauhan.site/beam-tv/)** ·
**[Download the latest release](https://github.com/TAGISWILD/beam-tv/releases/latest)**

## Features

- USB folder browsing with video, audio, image, and subtitle detection
- Local-network media browsing through Beam Companion Server or compatible
  DLNA/UPnP servers
- Direct local-file and HTTP media playback
- Sidecar SRT-to-WebVTT conversion and native WebVTT support
- Resume history stored locally on the TV
- Samsung remote and media-key navigation
- HTML picture-in-picture overlay
- Read-only access to selected media

## Remaining jobs

Beam v1.0.0 is usable, but there is meaningful work left for contributors.
Please comment on an issue before starting so two people do not solve the same
problem independently.

| Job | Area | Difficulty | Issue |
|---|---|---:|---|
| Run companion-server tests in GitHub Actions | Tooling | Starter | [#2](https://github.com/TAGISWILD/beam-tv/issues/2) |
| Test HTTP byte-range media streaming | Companion server | Starter | [#3](https://github.com/TAGISWILD/beam-tv/issues/3) |
| Correct ASS/SSA subtitle handling | TV app | Intermediate | [#4](https://github.com/TAGISWILD/beam-tv/issues/4) |
| Design IPv6-capable local discovery | TV + companion | Advanced | [#5](https://github.com/TAGISWILD/beam-tv/issues/5) |
| Complete an accessibility and navigation audit | TV app | Intermediate | [#6](https://github.com/TAGISWILD/beam-tv/issues/6) |
| Add localization infrastructure and Hindi | TV app | Intermediate | [#7](https://github.com/TAGISWILD/beam-tv/issues/7) |

More work is tracked under
[`help wanted`](https://github.com/TAGISWILD/beam-tv/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
and
[`good first issue`](https://github.com/TAGISWILD/beam-tv/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).

## Project structure

```text
.
├── config.xml               Tizen application manifest
├── index.html               Public product landing page
├── tv.html                  Tizen TV application entry point
├── css/                     TV user interface styles
├── icons/                   TV application icons
├── js/                      TV application source
└── beam-server/
    ├── main/                Electron process and local media server
    ├── renderer/            Companion desktop interface
    └── icons/               Desktop application icons
```

## Requirements

### TV application

- Samsung Tizen Studio
- Samsung TV certificate profile for installing on physical hardware
- A Samsung Tizen TV with developer mode enabled, or the Tizen TV emulator

To enable developer mode on the TV: open the Apps screen, select any app that
isn't installed, then enter `12345` on the remote and confirm. On newer
remotes with a dedicated `123` button, press that first, then enter
`1-2-3-4-5`. Toggle Developer Mode on, enter your PC's IP address when
prompted, and restart the TV.

The application manifest currently targets Tizen 6.0 or newer.

As an alternative to Tizen Studio, [apps2samsung.com](https://apps2samsung.com/)
is a third-party, open-source (MIT) tool that sideloads apps onto Samsung TVs
using the same official developer/certificate mechanism, without the full
Tizen Studio install. It is not affiliated with Samsung or this project.

### Companion server

- Node.js 20 or newer
- npm
- macOS or Windows

## Run the TV application in a browser

The browser preview uses mock Tizen APIs and sample data:

```bash
python3 -m http.server 8790
```

Open <http://localhost:8790/tv.html>.

The browser preview is useful for interface work, but USB, remote-control, and
real Tizen platform behavior must be tested on a TV or emulator.

## Build the Tizen package

Import the repository as an existing Tizen web project, select a valid Samsung
TV certificate profile, and build the signed package in Tizen Studio.

From a configured Tizen CLI environment, the equivalent flow is:

```bash
tizen build-web
tizen package -t wgt -s YOUR_CERTIFICATE_PROFILE -- .
```

Do not commit generated `.wgt` files, build output, or signing artifacts.

## Run the companion server

```bash
cd beam-server
npm ci
npm start
```

In the desktop application:

1. Add one or more folders to share.
2. Start the server.
3. Put the computer and TV on the same trusted local network.
4. Open **Network Media Servers** in Beam.
5. Discover the server, or add its description URL manually.

The companion server exposes shared media to devices on the local network. Only
share folders you are comfortable making accessible on that network.

## Build the companion server

```bash
cd beam-server
npm ci
npm run dist:mac
```

For Windows, run `npm run dist:win` from a supported Windows build environment.

## Supported media

Beam recognizes common containers and extensions, including MP4, MKV, AVI, MOV,
WebM, MPEG-TS, WMV, MP3, FLAC, WAV, AAC, OGG, M4A, WMA, JPEG, PNG, GIF, WebP,
BMP, SRT, and WebVTT.

Actual codec support depends on the Samsung TV model, firmware, and its native
HTML media decoder. Recognition by Beam does not guarantee that every TV can
decode every file.

## Privacy

Beam processes USB, playback, and local-network information on the TV. Saved
servers and resume history remain in local app storage. The project does not
include analytics, advertising SDKs, or a developer-operated cloud backend.

See [the English privacy policy](privacy-policy-en.html) or
[the Korean privacy policy](privacy-policy-ko.html).

## Security

Beam Companion Server is designed for trusted home or office networks. It does
not provide authentication or Internet-facing hardening. Do not expose its port
directly to the public Internet.

Please report security issues according to [SECURITY.md](SECURITY.md).

## Contributing

Bug reports, design proposals, translations, testing, and pull requests are
welcome. Beam is opted into Hacktoberfest and accepts meaningful contributions
throughout the year. See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md) before submitting a change.

## License

Beam is available under the [MIT License](LICENSE).
