# Minimal Figwheel Main Project

A minimal ClojureScript project using Figwheel Main for development.

## Getting Started

This project uses the latest patterns and dependencies from the figwheel-main repository, configured for Calva development workflow.

### Dependencies
- Clojure: 1.12.2
- ClojureScript: 1.12.42
- Figwheel Main: 0.2.20
- Rebel Readline: 0.1.4

### Running the Development Build

This project is configured for Calva, which will automatically detect and manage the figwheel-main builds. From VS Code with Calva:

1. Open the project in VS Code
2. Use **Calva: Start a Project REPL and Connect (aka Jack-In)**
3. Calva will detect the figwheel-main configuration and present build options
4. Select the development build to start

Alternatively, from the command line:

```bash
# Start the development build with REPL
clojure -M -m figwheel.main -b dev -r
```

This will:
1. Start watching your source files for changes
2. Open a browser window at `http://localhost:9500`
3. Launch a ClojureScript REPL connected to the browser

### Project Structure

```
minimal-figwheel-main/
├── deps.edn              # Project dependencies (no aliases needed for Calva)
├── dev.cljs.edn          # Development build configuration
├── src/
│   └── minimal/
│       └── core.cljs     # Main ClojureScript source
└── resources/
    └── public/
        └── index.html    # Host HTML page
```

### Development Workflow

1. Edit `src/minimal/core.cljs`
2. Save the file
3. Watch Figwheel automatically reload changes in the browser
4. Use the REPL to evaluate code interactively

### Build Configuration

The `dev.cljs.edn` file contains minimal build configuration:
- `:main` specifies the entry point namespace
- Additional compiler options can be added as needed

### Hot Reloading

Figwheel Main provides:
- Automatic compilation on file changes
- Hot code reloading without page refresh
- CSS reloading (add `:css-dirs` to figwheel-main.edn if needed)
- Excellent error reporting

### Calva Integration

This project is specifically configured for Calva:
- No build aliases in deps.edn (Calva manages the build process)
- Standard figwheel-main project structure
- Compatible with Calva's jack-in workflow

Enjoy your ClojureScript development with Figwheel Main and Calva!