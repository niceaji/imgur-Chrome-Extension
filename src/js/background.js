/// <reference path="utils.js" />
/// <reference path="model.js" />

var model = new Model(),
    portMessenger = new PortMessenger(),
    requestMessenger = new RequestMessenger();

/**************************
* Chrome hooks
**************************/

chrome.browserAction.setBadgeBackgroundColor({ color: [85, 85, 85, 155] });

chrome.browserAction.onClicked.addListener(function (tab) {
	chrome.tabs.create({
		url: "main.html",
		selected: true
	});
});

function setContextMenus() {
    
    chrome.contextMenus.removeAll();

    function handleCapture() {
        var evtD = new EventDispatcher(['EVENT_COMPLETE']);
        chrome.tabs.captureVisibleTab(null, { format: "png" }, function (img) {
            chrome.tabs.getSelected(null, function (tab) {
                requestMessenger.addListener("got_area", function (e) {
                    requestMessenger.removeListener("got_area", arguments.callee);
                    var canvas = document.createElement('canvas');
                    canvas.width = e.width;
                    canvas.height = e.height;
                    var ctx = canvas.getContext('2d');
                    var i = new Image();
                    i.src = img;
                    i.onload = function () {
                        ctx.drawImage(i, e.left, e.top, e.width, e.height, 0, 0, e.width, e.height);
                        evtD.dispatchEvent(evtD.EVENT_COMPLETE, canvas.toDataURL("image/png"));
                    };
                }, true);
                chrome.tabs.executeScript(tab.id, { file: "js/inject/captureArea.js" });
            });
        });
        return evtD;
    }

    function handleCapturePage() {
        var evtD = new EventDispatcher(['EVENT_COMPLETE']);

        var shots = [];

        chrome.tabs.getSelected(null, function (tab) {
        	requestMessenger.addListener("got_page", function (ret, resp) {
        		setTimeout(function () {
        			chrome.tabs.captureVisibleTab(null, { format: "png" }, function (img) {
        				shots.push(img);
        				if (ret.moreToCome) {
        					resp(true); // keep going
        				} else {
        					resp(false);
        					if (shots.length === 1) {
        						evtD.dispatchEvent(evtD.EVENT_COMPLETE, img);
        					} else {
        						var canvas = document.createElement('canvas');
        						var ctx = canvas.getContext('2d');
        						canvas.width = ret.width;
        						canvas.height = ret.height;
        						var overflowData = shots.splice(shots.length - 1, 1)[0];
        						for (var i = 0; i < shots.length; i++) {
        							(function (imgData, pos) {
        								var img = new Image();
        								img.src = imgData;
        								img.onload = function () {
        									ctx.drawImage(img, 0, 0, ret.width, ret.viewHeight, 0, ret.viewHeight * pos, ret.width, ret.viewHeight);
        									if (pos === shots.length - 1) {
        										var bottomImg = new Image();
        										bottomImg.src = overflowData;
        										bottomImg.onload = function () {
        											ctx.drawImage(bottomImg, 0, ret.overflow, ret.width, ret.viewHeight - ret.overflow, 0,
                                                                    ret.viewHeight * shots.length, ret.width, ret.viewHeight - ret.overflow);
        											evtD.dispatchEvent(evtD.EVENT_COMPLETE, canvas.toDataURL("image/png"));
        											requestMessenger.removeAllListeners("got_page");
        										}
        									}
        								}
        							})(shots[i], i);
        						}
        					}
        				}
        			});
        		}, 50);
        	});
        	chrome.tabs.executeScript(tab.id, { file: "js/inject/capturePage.js" });
        });
        return evtD;
    }

    function addToClipboard(url) {
        var txt = $$('input');
        document.body.appendChild(txt);
        txt.value = url;
        txt.select();
        document.execCommand('copy');
        document.body.removeChild(txt);
    }

    var capturePageContextMenuItem = chrome.contextMenus.create({
        "title": "capture page", "contexts": ["page"],
        "onclick": function (obj) {
            handleCapturePage().addEventListener('EVENT_COMPLETE', function(img) {
                var evt = model.unsorted.sendImage(encodeURIComponent(img.split(',')[1]));
                evt.type = "capture";
                uploadDelegate(evt);
            });
         }
    });

    var captureViewContextMenuItem = chrome.contextMenus.create({ "title": "capture view", "contexts": ["page"],
        "onclick": function (obj) {
            chrome.tabs.captureVisibleTab(null, { format: "png" }, function (img) {
                var evt = model.unsorted.sendImage(encodeURIComponent(img.split(',')[1]));
                evt.type = "capture";
                uploadDelegate(evt);
            });
        }
    });

    var captureAreaContextMenuItem = chrome.contextMenus.create({ "title": "capture area", "contexts": ["page"],
        "onclick": function (obj) {
            handleCapture().addEventListener('EVENT_COMPLETE', function (img) {
                var evt = model.unsorted.sendImage(encodeURIComponent(img.split(',')[1]));
                evt.type = "capture";
                uploadDelegate(evt);
            });

        }
    });

    var addImageContextMenuItem = chrome.contextMenus.create({ "title": "rehost image", "contexts": ["image"],
        "onclick": function (obj) {
            var evt = model.unsorted.sendImageURL(obj.srcUrl);
            evt.type = "rehost";
            uploadDelegate(evt);
        }
    });

   
   // capture to file system
   // if incognito, change

    if(model.authenticated.OAuthManager.GetAuthStatus()) {
        var authenticatedAlbums = model.authenticated.getAlbums();
        if (authenticatedAlbums.length > 0) {

            chrome.contextMenus.update(capturePageContextMenuItem, { title: "capture page to" });
            chrome.contextMenus.update(captureViewContextMenuItem, { title: "capture view to" });
            chrome.contextMenus.update(captureAreaContextMenuItem, { title: "capture area to" });
            chrome.contextMenus.update(addImageContextMenuItem, { title: "rehost image to" });


            chrome.contextMenus.create({
                "title": "- this computer -", "contexts": ["page"],
                "onclick": function (obj) {
                    handleCapturePage().addEventListener('EVENT_COMPLETE', function (img) {
                        var evt = model.unsorted.sendImage(encodeURIComponent(img.split(',')[1]));
                        evt.type = "capture";
                        uploadDelegate(evt);
                    });

                }, "parentId": capturePageContextMenuItem
            });


            chrome.contextMenus.create({
                "title": model.authenticated.getAccount().url, "contexts": ["page"],
                "onclick": function (obj) {
                    handleCapturePage().addEventListener('EVENT_COMPLETE', function (img) {
                        var evt = model.authenticated.sendImage("_userAlbum", img.split(',')[1]);
                        evt.type = "capture";
                        uploadDelegate(evt);
                    });

                }, "parentId": capturePageContextMenuItem
            });


            chrome.contextMenus.create({
                "title": "- this computer -", "contexts": ["page"],
                "onclick": function (obj) {
                    chrome.tabs.captureVisibleTab(null, { format: "png" }, function (img) {
                        var evt = model.unsorted.sendImage(encodeURIComponent(img.split(',')[1]));
                        evt.type = "capture";
                        uploadDelegate(evt);
                    });
                }, "parentId": captureViewContextMenuItem
            });

            chrome.contextMenus.create({
                "title": model.authenticated.getAccount().url, "contexts": ["page"],
                "onclick": function (obj) {
                    chrome.tabs.captureVisibleTab(null, { format: "png" }, function (img) {
                        var evt = model.authenticated.sendImage("_userAlbum", img.split(',')[1]);
                        evt.type = "capture";
                        uploadDelegate(evt);
                    });
                }, "parentId": captureViewContextMenuItem
            });

            chrome.contextMenus.create({
                "title": "- this computer -", "contexts": ["page"],
                "onclick": function (obj) {
                    handleCapture().addEventListener('EVENT_COMPLETE', function (img) {
                        var evt = model.unsorted.sendImage(encodeURIComponent(img.split(',')[1]));
                        evt.type = "capture";
                        uploadDelegate(evt);
                    });

                }, "parentId": captureAreaContextMenuItem
            });

            chrome.contextMenus.create({
                "title": model.authenticated.getAccount().url, "contexts": ["page"],
                "onclick": function (obj) {
                    handleCapture().addEventListener('EVENT_COMPLETE', function (img) {
                        var evt = model.authenticated.sendImage("_userAlbum", img.split(',')[1]);
                        evt.type = "capture";
                        uploadDelegate(evt);
                    });

                }, "parentId": captureAreaContextMenuItem
            });

            chrome.contextMenus.create({
                "title": "- this computer -", "contexts": ["image"],
                "onclick": function (obj) {
                    var evt = model.unsorted.sendImageURL(obj.srcUrl);
                    evt.type = "rehost";
                    uploadDelegate(evt);

                }, "parentId": addImageContextMenuItem
            });


            chrome.contextMenus.create({
                "title": model.authenticated.getAccount().url, "contexts": ["image"],
                "onclick": function (obj) {
                    var evt = model.authenticated.sendImageURL("_userAlbum", obj.srcUrl);
                    evt.type = "rehost";
                    uploadDelegate(evt);

                }, "parentId": addImageContextMenuItem
            });

            for (var i = 0; i < authenticatedAlbums.length; i++) {

                (function (album) {

                    if (album.title) {

                        // Extend
                        chrome.contextMenus.create({
                            "title": album.title, "contexts": ["page"],
                            "onclick": function (obj) {
                                handleCapturePage().addEventListener('EVENT_COMPLETE', function (img) {
                                    var evt = model.authenticated.sendImage(album.id, img.split(',')[1]);
                                    evt.type = "capture";
                                    uploadDelegate(evt);
                                });

                            }, "parentId": capturePageContextMenuItem
                        });


                        chrome.contextMenus.create({
                            "title": album.title, "contexts": ["page"],
                            "onclick": function (obj) {
                                chrome.tabs.captureVisibleTab(null, { format: "png" }, function (img) {
                                    var evt = model.authenticated.sendImage(album.id, img.split(',')[1]);
                                    evt.type = "capture";
                                    uploadDelegate(evt);
                                });
                            }, "parentId": captureViewContextMenuItem
                        });



                        chrome.contextMenus.create({
                            "title": album.title, "contexts": ["page"],
                            "onclick": function (obj) {
                                handleCapture().addEventListener('EVENT_COMPLETE', function (img) {
                                    var evt = model.authenticated.sendImage(album.id, img.split(',')[1]);
                                    evt.type = "capture";
                                    uploadDelegate(evt);

                                });

                            }, "parentId": captureAreaContextMenuItem
                        });

                        chrome.contextMenus.create({
                            "title": album.title, "contexts": ["image"],
                            "onclick": function (obj) {
                                var evt = model.authenticated.sendImageURL(album.id, obj.srcUrl);
                                evt.type = "rehost";
                                uploadDelegate(evt);

                            }, "parentId": addImageContextMenuItem
                        });

                    }
                })(authenticatedAlbums[i]);

            }

    }

    }

    function uploadCompleteNotification(message) {
        var notification = webkitNotifications.createNotification("img/logo.png", "Finished",  message);
        notification.show();
        setTimeout(function() { notification.cancel();}, 3000);
    }

    function uploadCompleteTab(url) {
    	chrome.tabs.create({ "url": url, "selected": true });
    }

    function uploadDelegate(evt) {

        chrome.browserAction.setBadgeText({ 'text': '0' });

        evt.addEventListener(evt.EVENT_PROGRESS, function (e) {
            chrome.browserAction.setBadgeText({ 'text': String(Math.floor(((e.loaded / e.total) * 100))) });
        });

        evt.addEventListener(evt.EVENT_COMPLETE, function () {
        	chrome.browserAction.setBadgeText({ 'text': '' });
        });

        evt.addEventListener(evt.EVENT_SUCCESS, function (data) {

            if (evt.type == "capture") {

                if (model.preferences.get('copyoncapture')) {
                    addToClipboard(data.links.original);
                    if (model.preferences.get('taboncapture')) {
                        uploadCompleteNotification("copied to your clipboard");
                    }
                }

                if (model.preferences.get('taboncapture')) {
                    uploadCompleteTab(data.links.original);
                } else {
                    uploadCompleteNotification(model.preferences.get('copyoncapture') ? "added to your album and copied to your clipboard" : "added to your album");
                }

            } else {

                if (model.preferences.get('copyonrehost')) {
                    addToClipboard(data.links.original);
                    if (model.preferences.get('tabonrehost')) {
                        uploadCompleteNotification("copied to your clipboard");
                    }
                }

                if (model.preferences.get('tabonrehost')) {
                    uploadCompleteTab(data.links.original);
                } else {
                    uploadCompleteNotification(model.preferences.get('copyonrehost') ? "rehosted to your album and copied to your clipboard" : "rehosted to your album");
                }

            }


        });

        evt.addEventListener(evt.EVENT_ERROR, showError);

    }

}

function showError(message) {
	chrome.browserAction.setBadgeText({ 'text': '' });
	webkitNotifications.createNotification("img/logo.png", "imgur failed", message).show();
}



function syncViews() {
    portMessenger.sendMessage("options", { Name: "sync" });
    portMessenger.sendMessage("main", { Name: "sync" });
}

// options page can clear authentication, which needs a sync
// main page can only sync when it's the result of getting a user
portMessenger.addListener("options", "sync", function () {
    syncViews();
});

portMessenger.addListener("main", "get_user", function () {

    var authTab,
        req = new XMLHttpRequest(),
        OAuth = model.authenticated.OAuthManager.Generate();

    function sendAuthAbortedMessage(tabId) {
        if (tabId == authTab) {
            requestMessenger.removeAllListeners("oauth_verified");
            portMessenger.sendMessage("main", "get_user_aborted");
        }
    }

    // Reset OAuth obj if user starts process and stops
    model.authenticated.OAuthManager.Reset();

    var requestTokenURL = OAuth.sign({
        path: 'https://api.imgur.com/oauth/request_token',
        parameters: {}
    }).signed_url;

    req.open("GET", requestTokenURL, true);
    req.onreadystatechange = function () {
        if (req.readyState == 4) {
            var res = OAuth._parseParameterString(req.responseText);
            OAuth.setTokensAndSecrets({
                access_secret: res.oauth_token_secret
            });
            chrome.tabs.create({
                url: 'https://api.imgur.com/oauth/authorize?oauth_token=' + res.oauth_token,
                selected: true
            }, function (tab) {
                authTab = tab.id;
                chrome.tabs.onRemoved.addListener(sendAuthAbortedMessage);
                requestMessenger.addListener("oauth_verified", function (verifier) {
                    requestMessenger.removeListener("oauth_verified", arguments.callee);
                    chrome.tabs.remove(tab.id);
                    OAuth.setTokensAndSecrets({
                        access_token: verifier
                    });
                    var accessTokenURL = OAuth.sign({ path: 'https://api.imgur.com/oauth/access_token',
                        parameters: { oauth_token: res.oauth_token }
                    }).signed_url;

                    var xhr = new XMLHttpRequest();
                    xhr.open("GET", accessTokenURL, true);
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState == 4) {
                            if (xhr.responseText) {
                                var resAccessToken = OAuth._parseParameterString(xhr.responseText);
                                // Set the auth tokens on the model so it can do calls
                                model.authenticated.OAuthManager.Set(resAccessToken.oauth_token, resAccessToken.oauth_token_secret);

                                // Send an event back so that that main page knows it can get user data
                                model.authenticated.fetchUser().addEventListener('EVENT_COMPLETE', function () {
                                    model.authenticated.fetchAlbums().addEventListener('EVENT_COMPLETE', function () {
                                        setContextMenus();
                                        authTab = -1;
                                        chrome.tabs.onRemoved.removeListener(sendAuthAbortedMessage);
                                        syncViews();
                                    });
                                });

                            }
                        }
                    };
                    xhr.send(null);
                });
            });
        }
    };
    req.send(null);

});


// Set itself to run
var ContextMenuSchedule = new function () {
    var defaultInterval = interval = 30000,
        currentTimeout;

    function send() {
        if (model.authenticated.OAuthManager.GetAuthStatus()) {
            model.authenticated.fetchAlbums().addEventListener('EVENT_COMPLETE', setContextMenus);
        } else {
            setContextMenus();
        }

        clearTimeout(currentTimeout);
        currentTimeout = null;

        currentTimeout = setTimeout(send, interval);

    }
    this.ResetInterval = function () {
        interval = defaultInterval;
        send()
    }
    this.SetInterval = function (newInterval) {
        interval = newInterval;
        send()
    }
    this.Start = function () {
        send();
    };

    requestMessenger.addListener("album_monitor_new", function () {
        ContextMenuSchedule.SetInterval(5000);
    });

    requestMessenger.addListener("album_monitor_closed", function () {
        ContextMenuSchedule.ResetInterval();
    });

    this.Start();

}

