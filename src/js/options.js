/// <reference path="utils.js" />
/// <reference path="model.js" />

var port = chrome.extension.connect({ name: "options" }),
    model = new Model();

var EClear,
    EConnections,
    ECopyOnRehost,
    ETabOnRehost,
    ECopyOnCapture,
    ETabOnCapture,
    ESubmit;


port.onMessage.addListener(function (msg) {
    window.location.reload();
});

window.onload = function () {

    EMain = $('nav-main'),
    EClear = $('btn-clear'),
    EConnections = $('connections'),
    EFreezeGifs = $('freeze-gifs'),
    ECopyOnRehost = $('copy-on-rehost'),
    ETabOnRehost = $('tab-on-rehost'),
    ECopyOnCapture = $('copy-on-capture'),
    ETabOnCapture = $('tab-on-capture'),
    ESubmit = $('submit');

    if (!model.authenticated.OAuthManager.GetAuthStatus()) {
        EClear.style.display = "none";
    } else {
        EClear.onclick = function () {
            if (confirm("Are you sure?")) {
                model.reset();
                port.postMessage({ Name: "sync" });
            }
        };
    }

    ESubmit.disabled = "disabled";

    EConnections.onclick = ECopyOnRehost.onclick = ETabOnRehost.onclick = ECopyOnCapture.onclick = ETabOnCapture.onclick = EFreezeGifs.onclick = function () {
        ESubmit.removeAttribute("disabled");
    };

    EConnections.value = model.preferences.get('connections');
    EFreezeGifs.checked = model.preferences.get('freezegifs');
    ECopyOnRehost.checked = model.preferences.get('copyonrehost');
    ETabOnRehost.checked = model.preferences.get('tabonrehost');
    ECopyOnCapture.checked = model.preferences.get('copyoncapture');
    ETabOnCapture.checked = model.preferences.get('taboncapture');


    ESubmit.onclick = function () {

        ESubmit.value = "saving...";
        ESubmit.style.cursor = "progress";

        model.preferences.set('connections', EConnections.value);
        model.preferences.set('freezegifs', EFreezeGifs.checked);
        model.preferences.set('copyonrehost', ECopyOnRehost.checked);
        model.preferences.set('tabonrehost', ETabOnRehost.checked);
        model.preferences.set('copyoncapture', ECopyOnCapture.checked);
        model.preferences.set('taboncapture', ETabOnCapture.checked);
        setTimeout(function () {
            port.postMessage({ Name: "sync" });
        }, 1000);
    }


};