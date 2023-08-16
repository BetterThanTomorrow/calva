# A workaround for Calva + LiveShare

A bubbly association from Clojure files to Notebooks, effervescently crafted to support [Calva](https://marketplace.visualstudio.com/items?itemName=betterthantomorrow.calva) + [LiveShare](https://code.visualstudio.com/learn/collaboration/live-share) users.

Because of an issue with LiveShare in VS Code making all Notebook associated files open in Notebooks we have this side-car extension to go with Calva. It is a workaround until the issue is fixed by the LiveShare team.

The issue is tracked here:

* Calva issue: [LiveShare participants incorrectly opening every Clojure file as if via "Open with Notebook"](https://github.com/BetterThanTomorrow/calva/issues/1850)
* LiveShare issue: [Guest opens Clojure file as a notebook (incorrectly)](https://github.com/MicrosoftDocs/live-share/issues/4765)

This extension only provides the notebook file association of Clojure files. All notebook supporting code lives in Calva. As a Calva user you will get this extension automatically installed and enabled together with Calva. As long as you have it enabled you will have Clojure Notebooks in VS Code when using Calva.

To disable Notebook association and make LiveShare sessions work better (without Notebooks, sadly), disable this extension. You can do this at will without reloading or reconnecting.

<video src="https://user-images.githubusercontent.com/30010/226100222-cd14f066-67ff-49aa-92e5-98c71d508bc8.mp4"></video>