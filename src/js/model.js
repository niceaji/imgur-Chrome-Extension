/// <reference path="utils.js" />
/// <reference path="chrome_ex_oauthsimple.js" />

function Model() {

    /**************************
    * Set up DAL
    **************************/

    var DAL = new LocalStoreDAL('imgur');
    //DAL.reset({});


    // -1 ~ 0.5 - 1.0.3
    if (!DAL.get('preferences')) {

        var unsorted = DAL.get('storedImages') || [];

        var preferences = {
            connections: DAL.get('connections') || 1,
            currentAlbum: '_thisComputer'
        };
        // utils should add be able to set properties for oauth 1 level deep
        DAL.reset({ unsorted: unsorted, albums: [], preferences: preferences, account: {}, OAuthTokens: {access_token: null, access_token_secret: null} });
    }

    // 1.0.3 - 1.0.4

    if (DAL.get('preferences.copyonrehost') == null) {

        DAL.set('preferences.copyonrehost', false);
        DAL.set('preferences.tabonrehost', true);
        DAL.set('preferences.copyoncapture', false);
        DAL.set('preferences.taboncapture', true);

    };

    // 1.0.4, 1.0.5 - 1.1

    if (DAL.get('preferences.freezegifs') == null) {

    	DAL.set('preferences.freezegifs', true);
    	DAL.set('preferences.shownavairywarning', false);

    };


    /**************************
    * Private vars
    **************************/

    var ErrorMessages = {
        Upload: "Something went fruity. Please try again, or contact me."
    };
    var CurrentlyProcessing = 0;

    var $this = this;


    /**************************
    * Public vars
    **************************/

    /**************************
    * Public methods
    **************************/

    this.reset = function () {
        DAL.set('OAuthTokens.access_token', null);
        DAL.set('OAuthTokens.access_token_secret', null);
        DAL.set('preferences.currentAlbum', '_thisComputer');
        this.authenticated.OAuthManager.Reset();
    };


    this.preferences = new function () {

        this.get = function (preference) {
            return DAL.get('preferences.' + preference);
        };

        this.set = function (preference, value) {
            DAL.set('preferences.' + preference, value);
        };

    }


    this.currentAlbum = new function () {

        this.get = function () {
            
            var albums = DAL.get('albums'),
                currentAlbum = DAL.get('preferences.currentAlbum');


                if (!albums || albums.indexOfObject('id', currentAlbum) == -1) {
                    if (currentAlbum !== '_userAlbum') {
                        currentAlbum = '_thisComputer';
                        DAL.set('preferences.currentAlbum', currentAlbum);
                    }
            }

            return DAL.get('preferences.currentAlbum');
        };

        this.set = function (value) {
            DAL.set('preferences.currentAlbum', value);
        };

    };

    this.xhrManager = new function (model) {
        var queue = [];
        // { handler, (Function), argsObj: (Object), evtD: (EventDispatcher)}
        // Possible: retries and priority
        this.add = function (queueItem) {
            queue.push(queueItem);
            processQueue();
        };
        function processQueue() {
            

            if (CurrentlyProcessing < $this.preferences.get('connections')) {
                CurrentlyProcessing++;
                var item = queue.splice(queue.length - 1, 1)[0];
                item.evtD.addEventListener(['EVENT_COMPLETE', 'EVENT_ERROR', 'EVENT_PROGRESS'], function (e) {
                    CurrentlyProcessing--;
                    // next item
                    if (queue.length !== 0) {
                        
                        processQueue();
                    }
                });
                item.handler.call(item, item.argsObj, item.evtD);
            }
        }
    } (this);







    this.authenticated = new function (model) {

    	var $this = this;

    	this.OAuthManager = new function () {

    		this.Generate = function () {
    			var OAuth = new OAuthSimple('e37b7918f24a70bfc8b4729afb923e9604eb4ab1e', '4ce87676c5d8f13db9982c6dd085b498');

    			var OAuthTokens = DAL.get('OAuthTokens');
    			// Set OAuth tokens from local storage if they are there
    			if (OAuthTokens.access_token) {
    				OAuth.setTokensAndSecrets({
    					access_token: OAuthTokens.access_token,
    					access_secret: OAuthTokens.access_token_secret
    				});
    			}
    			return OAuth;
    		};

    		this.Reset = function () {
    			DAL.set('OAuthTokens.access_token', null);
    			DAL.set('OAuthTokens.access_token_secret', null);
    		}

    		this.Set = function (access_token, access_token_secret) {
    			DAL.set('OAuthTokens.access_token', access_token);
    			DAL.set('OAuthTokens.access_token_secret', access_token_secret);
    		};

    		this.GetAuthStatus = function () {
    			return DAL.get('OAuthTokens.access_token') != null;
    		};

    	}

    	this.getAccount = function () {
    		return DAL.get('account');
    	};

    	this.fetchUser = function () {
    		var fetchURL = this.OAuthManager.Generate().sign({
    			path: 'https://api.imgur.com/2/account.json',
    			parameters: {}
    		}).signed_url;
    		var evtD = new EventDispatcher(['EVENT_COMPLETE']),
                xhr = new XMLHttpRequest();
    		xhr.open("GET", fetchURL, true);
    		xhr.onreadystatechange = function () {
    			if (xhr.readyState === 4) {
    				if (xhr.status === 200) {
    					DAL.set('account', JSON.parse(xhr.responseText).account);
    					evtD.dispatchEvent(evtD.EVENT_COMPLETE);
    				} else {
    					var message;
    					try {
    						message = JSON.parse(xhr.responseText).error.message;
    					} catch (err) {
    						message = "Something is wrong with imgur, please try again soon";
    					}
    					evtD.dispatchEvent('EVENT_ERROR', message);
    				}
    			}
    		};
    		xhr.send(null);
    		return evtD;
    	};

    	this.getAlbums = function () {
    		return DAL.get('albums');
    	};

    	this.fetchUserImages = function () {
    		var fetchURL = this.OAuthManager.Generate().sign({
    			path: 'https://api.imgur.com/2/account/images.json',
    			parameters: {
    				noalbum: true
    			}
    		}).signed_url;
    		var evtD = new EventDispatcher(['EVENT_COMPLETE']),
                xhr = new XMLHttpRequest();
    		xhr.open("GET", fetchURL, true);
    		xhr.onreadystatechange = function () {
    			if (xhr.readyState === 4) {
    				if (xhr.status === 200) {
    					evtD.dispatchEvent(evtD.EVENT_COMPLETE, JSON.parse(xhr.responseText).images);
    				} else {
    					var message;
    					try {
    						message = JSON.parse(xhr.responseText).error.message;
    					} catch (err) {
    						message = "Something is wrong with imgur, please try again soon";
    					}
    					evtD.dispatchEvent('EVENT_ERROR', message);
    				}
    			}
    		};
    		xhr.send(null);
    		return evtD;
    	};

    	this.fetchAlbums = function () {

    		var fetchURL = this.OAuthManager.Generate().sign({
    			path: 'https://api.imgur.com/2/account/albums.json',
    			parameters: {}
    		}).signed_url;
    		var evtD = new EventDispatcher(['EVENT_COMPLETE', 'EVENT_ERROR']),
                xhr = new XMLHttpRequest();
    		xhr.open("GET", fetchURL, true);
    		xhr.onreadystatechange = function () {
    			if (xhr.readyState === 4) {
    				if (xhr.status === 200) {
    					DAL.set('albums', JSON.parse(xhr.responseText).albums);
    					evtD.dispatchEvent(evtD.EVENT_COMPLETE);
    				} else if (xhr.status === 404) {
    					// No albums, but am being given back a 404...
    					DAL.set('albums', []);
    					evtD.dispatchEvent(evtD.EVENT_COMPLETE);
    				} else {
    					var message;
    					try {
    						message = JSON.parse(xhr.responseText).error.message;
    					} catch (err) {
    						message = "Something is wrong with imgur, please try again soon";
    					}
    					evtD.dispatchEvent('EVENT_ERROR', message);
    				}
    			}
    		};
    		xhr.send(null);
    		return evtD;
    	};

    	this.fetchAlbumImages = function (ID) {
    		var fetchURL = this.OAuthManager.Generate().sign({
    			path: 'https://api.imgur.com/2/account/albums/' + ID + '.json',
    			parameters: {
    				count: 100
    			}
    		}).signed_url;
    		var evtD = new EventDispatcher(['EVENT_COMPLETE', 'EVENT_SUCCESS', 'EVENT_ERROR']),
                xhr = new XMLHttpRequest();
    		xhr.open("GET", fetchURL, true);
    		xhr.onreadystatechange = function () {
    			if (xhr.readyState === 4) {
    				evtD.dispatchEvent(evtD.EVENT_COMPLETE);
    				if (xhr.status === 200) {
    					evtD.dispatchEvent(evtD.EVENT_SUCCESS, JSON.parse(xhr.responseText).albums);
    				} else {
    					var message;
    					try {
    						message = JSON.parse(xhr.responseText).error.message;
    					} catch (err) {
    						message = "Something is wrong with imgur, please try again soon";
    					}
    					evtD.dispatchEvent('EVENT_ERROR', message);
    				}
    			}
    		};
    		xhr.send(null);
    		return evtD;
    	};

    	this.makeAlbum = function (title) {
    		var makeData = this.OAuthManager.Generate().sign({
    			path: 'https://api.imgur.com/2/account/albums.json',
    			action: "POST",
    			parameters: {
    				title: title,
    				privacy: this.getAccount().default_album_privacy
    			}
    		}).post_data;

    		var evtD = new EventDispatcher(['EVENT_COMPLETE', 'EVENT_ERROR']),
                xhr = new XMLHttpRequest();
    		xhr.open("POST", "https://api.imgur.com/2/account/albums.json", true);
    		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    		xhr.onreadystatechange = function () {
    			if (xhr.readyState === 4) {
    				if (xhr.status === 200) {

    					var albums = DAL.get('albums'),
                                album = JSON.parse(xhr.responseText).albums;
    					albums.splice(albums.length - 1, 0, album);
    					evtD.dispatchEvent(evtD.EVENT_COMPLETE, album);

    					DAL.set('albums', albums);

    				} else {
    					var message;
    					try {
    						message = JSON.parse(xhr.responseText).error.message;
    					} catch (err) {
    						message = "Something is wrong with imgur, please try again soon";
    					}
    					evtD.dispatchEvent('EVENT_ERROR', message);
    				}
    			}
    		};
    		xhr.send(makeData);
    		return evtD;
    	};

    	this.sendImage = function (album, image) {

    		var evtD = new EventDispatcher(['EVENT_COMPLETE', 'EVENT_SUCCESS', 'EVENT_ERROR', 'EVENT_PROGRESS']);
    		model.xhrManager.add({
    			handler: function () {
    				var xhr = new XMLHttpRequest();
    				var sendImageURL = $this.OAuthManager.Generate().sign({
    					path: 'https://api.imgur.com/2/account/images.json',
    					action: "POST",
    					parameters: {
    						type: "base64",
    						image: image
    					}
    				}).post_data;

    				xhr.open("POST", "https://api.imgur.com/2/account/images.json", true);
    				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    				var upload = xhr.upload;
    				upload.addEventListener("progress", function (ev) {
    					if (ev.lengthComputable) {
    						evtD.dispatchEvent('EVENT_PROGRESS', { loaded: ev.loaded, total: ev.total });
    					}
    				}, false);

    				xhr.onreadystatechange = function () {
    					if (xhr.readyState === 4) {

    						if (xhr.status === 200) {

    							var data = JSON.parse(xhr.responseText).images;

    							if (album == '_userAlbum') {
    								evtD.dispatchEvent(evtD.EVENT_COMPLETE, data);
    								evtD.dispatchEvent(evtD.EVENT_SUCCESS, data);
    							} else {

    								var accReq = new XMLHttpRequest(),
                                    accPath = 'https://api.imgur.com/2/account/albums/' + album + '.json';
    								var sendImageToAccountURL = $this.OAuthManager.Generate().sign({
    									path: accPath,
    									action: "POST",
    									parameters: {
    										add_images: data.image.hash
    									}
    								}).post_data;

    								accReq.open("POST", accPath, true);
    								accReq.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    								accReq.onreadystatechange = function () {
    									if (accReq.readyState == 4) {

    										evtD.dispatchEvent(evtD.EVENT_COMPLETE, data);

    										if (accReq.status === 200) {
    											evtD.dispatchEvent(evtD.EVENT_SUCCESS, data);
    										} else {
    											evtD.dispatchEvent(evtD.EVENT_ERROR, JSON.parse(accReq.responseText).error.message);
    										}


    									}
    								};
    								accReq.send(sendImageToAccountURL);

    							}

    						} else {

    							var message;
    							try {
    								message = JSON.parse(xhr.responseText).error.message;
    							} catch (err) {
    								message = "Something is wrong with imgur, please try again soon";
    							}
    							evtD.dispatchEvent('EVENT_ERROR', message);

    						}

    					}
    				};
    				xhr.send(sendImageURL);

    			},
    			evtD: evtD
    		});

    		return evtD;
    	};

    	this.sendImageURL = function (album, url) {
    		var evtD = new EventDispatcher(['EVENT_COMPLETE', 'EVENT_SUCCESS', 'EVENT_ERROR', 'EVENT_PROGRESS']);

    		model.xhrManager.add({
    			handler: function () {
    				var xhr = new XMLHttpRequest();
    				var sURL = $this.OAuthManager.Generate().sign({
    					path: 'https://api.imgur.com/2/account/images.json',
    					action: "POST",
    					parameters: {
    						image: url
    					}
    				}).post_data;

    				xhr.open("POST", "https://api.imgur.com/2/account/images.json", true);
    				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    				var upload = xhr.upload;
    				upload.addEventListener("progress", function (ev) {
    					if (ev.lengthComputable) {
    						evtD.dispatchEvent('EVENT_PROGRESS', { loaded: ev.loaded, total: ev.total });
    					}
    				}, false);

    				xhr.onreadystatechange = function () {

    					if (xhr.readyState === 4) {

    						if (xhr.status === 200) {
    							var data = JSON.parse(xhr.responseText).images;

    							if (album == '_userAlbum') {
    								evtD.dispatchEvent(evtD.EVENT_COMPLETE, {});
    								evtD.dispatchEvent(evtD.EVENT_SUCCESS, data);
    							} else {

    								var accReq = new XMLHttpRequest();
    								var accPath = 'https://api.imgur.com/2/account/albums/' + album + '.json';
    								var sendImageToAccountURL = $this.OAuthManager.Generate().sign({
    									path: accPath,
    									action: "POST",
    									parameters: {
    										add_images: data.image.hash
    									}
    								}).post_data;
    								accReq.open("POST", accPath, true);
    								accReq.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    								accReq.onreadystatechange = function () {
    									if (accReq.readyState == 4) {

    										evtD.dispatchEvent(evtD.EVENT_COMPLETE, {});

    										if (accReq.status === 200) {
    											evtD.dispatchEvent(evtD.EVENT_SUCCESS, data);
    										} else {
    											evtD.dispatchEvent(evtD.EVENT_ERROR, JSON.parse(accReq.responseText).error.message);
    										}
    									}
    								};
    								accReq.send(sendImageToAccountURL);

    							}

    						} else {
    							var message;
    							try {
    								message = JSON.parse(xhr.responseText).error.message;
    							} catch (err) {
    								message = "Something is wrong with imgur, please try again soon";
    							}
    							evtD.dispatchEvent('EVENT_ERROR', message);
    						}
    					}
    				};
    				xhr.send(sURL);
    			},
    			evtD: evtD
    		});

    		return evtD;
    	};

    	this.deleteImage = function (deletehash) {
    		var evtD = new EventDispatcher(['EVENT_COMPLETE', 'EVENT_ERROR']);
    		model.xhrManager.add({
    			handler: function () {
    				var xhr = new XMLHttpRequest();
    				xhr.open("GET", "https://api.imgur.com/2/delete/" + deletehash, true);
    				xhr.onreadystatechange = function () {
    					if (xhr.readyState === 4) {

    						if (xhr.status === 200) {
    							evtD.dispatchEvent(evtD.EVENT_COMPLETE);
    						}
    						else {
    							var message;
    							try {
    								message = JSON.parse(xhr.responseText).error.message;
    							} catch (err) {
    								message = "Something is wrong with imgur, please try again soon";
    							}
    							evtD.dispatchEvent('EVENT_ERROR', message);

    						}

    					}

    				};
    				xhr.send(null);
    			},
    			evtD: evtD
    		});
    		return evtD;
    	};

    } (this);










    this.unsorted = new function (model) {

    	this.get = function () {
    		return DAL.get('unsorted');
    	};

    	var Key = "0749d60cb0b0b42f2f0240bc1747252f";

    	this.sendImageURL = function (url) {
    		var evtD = new EventDispatcher(['EVENT_COMPLETE', 'EVENT_SUCCESS', 'EVENT_ERROR', 'EVENT_PROGRESS']);

    		model.xhrManager.add({
    			handler: function () {
    				var xhr = new XMLHttpRequest();
    				xhr.open("POST", "https://api.imgur.com/2/upload.json", true);
    				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    				var upload = xhr.upload;
    				upload.addEventListener("progress", function (ev) {
    					if (ev.lengthComputable) {
    						evtD.dispatchEvent('EVENT_PROGRESS', { loaded: ev.loaded, total: ev.total });
    					}
    				}, false);

    				xhr.onreadystatechange = function () {
    					if (xhr.readyState == 4) {
    						evtD.dispatchEvent(evtD.EVENT_COMPLETE);
    						if (xhr.status === 200) {
    							var data = JSON.parse(xhr.responseText);
    							if (data.upload) {
    								var currentlyStoredImages = DAL.get('unsorted');
    								currentlyStoredImages.splice(currentlyStoredImages.length - 1, 0, data.upload);
    								DAL.set('unsorted', currentlyStoredImages);
    								evtD.dispatchEvent(evtD.EVENT_SUCCESS, data.upload);
    							} else {
    								evtD.dispatchEvent(evtD.EVENT_ERROR, data.error.message);
    							}

    						} else {
    							evtD.dispatchEvent(evtD.EVENT_ERROR, ErrorMessages.Upload);
    						}

    					}
    				};
    				xhr.send("image=" + encodeURIComponent(url) + "&key=" + Key);
    			},
    			evtD: evtD
    		});
    		return evtD;
    	};

    	this.sendImage = function (image) {
    		var evtD = new EventDispatcher(['EVENT_COMPLETE', 'EVENT_SUCCESS', 'EVENT_ERROR', 'EVENT_PROGRESS']);
    		model.xhrManager.add({
    			handler: function () {
    				var xhr = new XMLHttpRequest();
    				xhr.open("POST", "https://api.imgur.com/2/upload.json", true);
    				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    				var upload = xhr.upload;
    				upload.addEventListener("progress", function (ev) {
    					if (ev.lengthComputable) {
    						evtD.dispatchEvent('EVENT_PROGRESS', { loaded: ev.loaded, total: ev.total });
    					}
    				}, false);

    				xhr.onreadystatechange = function () {
    					if (xhr.readyState == 4) {

    						evtD.dispatchEvent(evtD.EVENT_COMPLETE);

    						if (xhr.status === 200) {

    							var data = JSON.parse(xhr.responseText);
    							if (data.upload) {
    								var currentlyStoredImages = DAL.get('unsorted');
    								currentlyStoredImages.splice(currentlyStoredImages.length - 1, 0, data.upload);
    								DAL.set('unsorted', currentlyStoredImages);
    								evtD.dispatchEvent(evtD.EVENT_SUCCESS, data.upload);
    							}
    							else {
    								evtD.dispatchEvent(evtD.EVENT_ERROR, ErrorMessages.Upload);
    							}
    						} else {
    							evtD.dispatchEvent(evtD.EVENT_ERROR, data.error.message);
    						}


    					}
    				};
    				xhr.send("image=" + image + "&key=" + Key);
    			},
    			evtD: evtD
    		});
    		return evtD;
    	};

    	this.deleteImage = function (deletehash) {
    		var evtD = new EventDispatcher(['EVENT_COMPLETE', 'EVENT_ERROR']);
    		model.xhrManager.add({
    			handler: function () {
    				var xhr = new XMLHttpRequest();
    				xhr.open("GET", "https://api.imgur.com/2/delete/" + deletehash, true);
    				xhr.onreadystatechange = function () {
    					if (xhr.readyState == 4) {
    						if (xhr.responseText) {
    							var images = DAL.get('unsorted');
    							var storageItem = images.indexOfObject('image.deletehash', deletehash);
    							if (storageItem !== -1) {
    								images.splice(storageItem, 1);
    							} else {

    							}
    							DAL.set('unsorted', images);
    							evtD.dispatchEvent(evtD.EVENT_COMPLETE);
    						}
    					} else {
    						evtD.dispatchEvent(evtD.EVENT_ERROR);
    					}
    				};
    				xhr.send(null);
    			},
    			evtD: evtD
    		});
    		return evtD;
    	};
    } (this);

}