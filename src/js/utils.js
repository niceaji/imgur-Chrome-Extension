function EventDispatcher(events) {
	var listeners = [];
	if (events) {
		for (var i = 0; i < events.length; i++) {
			this[events[i]] = events[i];
		}
	}
	this.getListeners = function () {
	    return listeners;
	}
	this.addEventListener = function (title, method, handler) {
		function add(title) {
		    if (!listeners[title]) { listeners[title] = []; }
		    listeners[title].push({ method: method, handler: handler });
		}
		if ( typeof(title) == 'object' && title.length ) {
			for(var i = 0; i < title.length; i++) {
				add(title[i]);
			}
		} else {
			add(title);
		}
	    return this;
	};
	this.removeEventListener = function (title, method) {
		if (listeners[title]) {
			for (var i = 0; i < listeners[title].length; i++) {
				if (listeners[title][i].method == method) {
					listeners[title].splice(i, 1);
				}
			}
		}
		return this;
	};
	this.dispatchEvent = function (title, args) {
	    if (listeners[title]) {
	        for (var i = 0; i < listeners[title].length; i++) {
	            listeners[title][i].method(args);
	        }
	    }
	    return this;
	};
	this.removeAllEventListeners = function () {
		listeners = [];
		return this;
	};
	this.removeEventListenersByHandler = function (title, handler) {
		if (listeners[title]) {
			for (var i = 0; i < listeners[title].length; i++) {
				if (listeners[title][i].handler == handler) {
					listeners[title].splice(i, 1);
				}
			}
		}
		return this;
	};
	return this;
}




function PortMessenger () {
    var listeners = {};
    var connectedPorts = {};
    chrome.extension.onConnect.addListener(function (port) {
        if (listeners[port.name] && listeners[port.name].onConnect) {
            listeners[port.name].port = port;
            listeners[port.name].onConnect(port)
        }
        if (!connectedPorts[port.name]) {
            connectedPorts[port.name] = [];
        }

        connectedPorts[port.name].push(port);

        port.onDisconnect.addListener(function () {
            var connectedArray = connectedPorts[port.name],
            connectedIndex = connectedArray.indexOf(port);
            if (connectedIndex !== -1) {
                connectedArray.splice(connectedIndex, 1)
            }
        });
    });
    this.addListener = function (portName, message, handler) {
        if (!listeners[portName]) {
            listeners[portName] = {}
        }
        if (!listeners[portName][message]) {
            listeners[portName][message] = []
        }
        listeners[portName][message].push(handler);
        if (!listeners[portName].port) {
            listeners[portName].onConnect = function (port) {
                listeners[portName].port.onMessage.addListener(function (msg) {
                    var listenersArray = listeners[portName][msg.Name];
                    if (listeners[portName][msg.Name]) {
                        for (var i = 0; i < listenersArray.length; i++) {
                            listenersArray[i](msg.Data)
                        }
                    }
                })
            }
        }
    };
    this.removeListener = function (portName, message, handler) {
        var listenersArray = listeners[portName][message],
            listenerIndex = listenersArray.indexOf(handler);
        if (listenerIndex !== -1) {
            listenersArray.splice(listenerIndex, 1)
        }
    };
    this.sendMessage = function (portName, message, currentTab) {
        
        if (connectedPorts[portName] && connectedPorts[portName].length > 0) {
            for (var i = 0; i < connectedPorts[portName].length; i++) {
                var port = connectedPorts[portName][i];
                if (currentTab) {
                    chrome.tabs.getSelected(null, function (tab) {
                        if (port.sender.tab && port.sender.tab.id && port.sender.tab.id === tab.id) {
                            port.postMessage(message);
                        }
                    })
                } else {
                    port.postMessage(message);
                }

            }
        }
    }
};

function RequestMessenger() {

    var listeners = {};

    this.addListener = function (requestName, handler) {
        if (!listeners[requestName]) {
            listeners[requestName] = [];
        }
        listeners[requestName].push(handler);
    };

    this.removeListener = function (requestName, handler) {
        if (listeners[requestName]) {
            var listenersArray = listeners[requestName],
                listenerIndex = listenersArray.indexOf(handler);
            if (listenerIndex !== -1) {
                listenersArray.splice(listenerIndex, 1)
            }
        }
    };

    this.removeAllListeners = function (requestName) {
        if (listeners[requestName]) {
            listeners[requestName] = [];
        };
    }

    chrome.extension.onRequest.addListener(function (request, sender, response) {
        if (listeners[request.Name]) {
            for (var i = 0; i < listeners[request.Name].length; i++) {
                listeners[request.Name][i](request.Data, response);
            }
        }
    });

}



Array.prototype.indexOf = Array.indexOf || function (needle) {
	for (var i = 0; i < this.length; i++) {
		if (this[i] == needle) {
			return i;
		}
	}
	return -1;
};

Array.prototype.indexOfObject = function (prop, val) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] == val) {
            return i;
        } else if (getNestedObjectProperty(this[i], prop) == val) {
            return i;
        }
    }
    return -1;
};



function updateNestedObjectProperty(obj, keyStr, value) {
    var keyPath = keyStr.split('.');
    var lastKeyIndex = keyPath.length - 1;
    for (var i = 0; i < lastKeyIndex; ++i) {
        key = keyPath[i];
        if (!(key in obj))
            obj[key] = {}
        obj = obj[key];
    }
    obj[keyPath[lastKeyIndex]] = value;
}

function getNestedObjectProperty (ob, key) {
    var path = key.split('.');

    var objTraversals = 0;

    function traverse(obj) {
        if (typeof obj == 'object') {
            for (var y in obj) {
                if (y == path[objTraversals]) {
                    if (objTraversals == path.length - 1) {
                        return obj[y];
                    } else {
                        objTraversals++;
                        return traverse(obj[y]);
                    }
                }
            }
        }
        return null;
    }

    for (var x in ob) {
        if (x == path[objTraversals]) {
            if (objTraversals == path.length - 1) {
                return ob[x] || "";
            } else {
                objTraversals++;
                return traverse(ob[x]);
            }
        }
    }
    return null;
};


function $(e) {
    /// <summary>Gets a DOM element by ID.</summary>
    /// <param name="id" type="String">The DOM Element requested</param>
    /// <returns type="DOMElement">Returns a DOM Element.</returns>
	return document.getElementById(e);
}
function $$(e) {
	return document.createElement(e);
}

function getXMLString(xml, node) {
	return xml.querySelectorAll(node)[0].firstChild.nodeValue;
}


function LocalStoreDAL(storage, defaultModel) {
    /// <summary>Gets and sets localstorage</summary>
    /// <param name="storage" type="String">The name of the localstorage to get or set</param>
    /// <param name="model" type="Object">Object to store</param>
    /// <returns type="LocalstorageDAL">Returns a localStorage access layer</returns>

    this.storage = storage;

	if (!localStorage[storage] || typeof localStorage[storage] == 'undefined') {
		localStorage[storage] = JSON.stringify(defaultModel || {});
	}

    this.set = function (key, val) {
        /// <summary>Sets the value of a localStorage item</summary>
        /// <param name="key" type="String">The key of the item in localStorage</param>
        /// <param name="value">The value to store</param>
		var localData = JSON.parse(localStorage[this.storage]);
		updateNestedObjectProperty(localData, key, val);
		localStorage[storage] = JSON.stringify(localData);
	};

	this.get = function (key) {
		var localData = JSON.parse(localStorage[this.storage]);
		if (key) {
		    return getNestedObjectProperty(localData, key);
		}
		return localData;
    };

    this.reset = function (newModel) {
        localStorage[this.storage] = JSON.stringify(newModel);
    };

}