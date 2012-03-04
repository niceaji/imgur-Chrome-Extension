if (document.getElementsByTagName('form').length == 0) {
    chrome.extension.sendRequest({ Name: "oauth_verified", Data: document.querySelectorAll('#text-content .accent.green')[0].innerHTML });
}