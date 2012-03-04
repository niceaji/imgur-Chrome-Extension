/// <reference path="utils.js" />
/// <reference path="model.js" />



var port = chrome.extension.connect({ name: "main" }),
    model = new Model(),
    EWrap,
    ENav,
    ENavConnect,
    ENavSelect,
	ENavDownload,
	ENavDelete,
    ENavOptions,
    EAlbums,
    CurrentAlbum,
    ECurrentAlbum,
    EStatusBar,
	EStatusBarLink;


// Aviary

var featherEditor = new Aviary.Feather({
    apiKey: 'b073f6881',
    openType: 'lightbox',
    theme: 'black',
    tools: 'all',
    appendTo: '',
    onSave: function (imageID, newURL) {
        featherEditor.close();
        makeURLItem(newURL);
    }
});

function uploadFiles(e) {
    
    var noImages = ECurrentAlbum.querySelectorAll('.no-images')[0];
    if (noImages) {
        ECurrentAlbum.removeChild(noImages);
    }

    var filesObj = e.dataTransfer.files,
        files = [];

    for (var v = 0; v < filesObj.length; v++) {
        if (filesObj[v].type.match(/image.*/)) {
            files.push(filesObj[v]);
        }
    }
    if (files.length > 0) {
        for (var i = 0; i < files.length; i++) {
            var file = files[i],
                reader = new FileReader();
            reader.onload = function (e) {
                makeItem(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    } else {
        
    }
}

function makeImage(fileData) {

    var img = $$('image');
    img.src = fileData;
    img.style.display = 'none';
    img.onload = function () {
        resizeImage(this);
        img.style.display = 'block';
    };

    return img;

}

function makeItem(fileData) {
    var ul = ECurrentAlbum.querySelectorAll('ul')[0],
        img = makeImage(fileData);
    var loadingItem = makeLoadingItem(img);
    var progress = loadingItem.querySelectorAll('progress')[0];
    ul.insertBefore(loadingItem, ul.firstChild);
    var evt;
    if (CurrentAlbum == "_thisComputer") {
        evt = model.unsorted.sendImage(encodeURIComponent(fileData.split(',')[1]));
        evt.addEventListener('EVENT_SUCCESS', function (e) {
        	convertLoadingToAlbum(loadingItem, e);
        });
    } else {
        evt = model.authenticated.sendImage(CurrentAlbum, fileData.split(',')[1]);
        evt.addEventListener('EVENT_SUCCESS', function (e) {
            convertLoadingToAlbum(loadingItem, e);
        });
    }
                
    evt.addEventListener(evt.EVENT_PROGRESS, function (e) {
        progress.value = Math.floor(((e.loaded/e.total) * 100));
    });

                
    evt.addEventListener('EVENT_ERROR', function(message) {
        var progress = loadingItem.querySelectorAll('progress')[0];
        loadingItem.removeChild(progress);
        loadingItem.classList.add('error');
        loadingItem.onclick = function() { alert(message); };
    });
}

function makeURLItem(URL) {
    var ul = ECurrentAlbum.querySelectorAll('ul')[0],
        img = makeImage(URL);
    var loadingItem = makeLoadingItem(img);
    var progress = loadingItem.querySelectorAll('progress')[0];
    ul.insertBefore(loadingItem, ul.firstChild);
    var evt;
    if (CurrentAlbum == "_thisComputer") {
        evt = model.unsorted.sendImageURL(URL);
        evt.addEventListener('EVENT_SUCCESS', function (e) {
            convertLoadingToAlbum(loadingItem, e);
        });
    } else {
        evt = model.authenticated.sendImageURL(CurrentAlbum, URL);
        evt.addEventListener('EVENT_SUCCESS', function (e) {
            convertLoadingToAlbum(loadingItem, e);
        });
    }

    evt.addEventListener(evt.EVENT_PROGRESS, function (e) {
        progress.value = Math.floor(((e.loaded / e.total) * 100));
    });


    evt.addEventListener('EVENT_ERROR', function (message) {
        var progress = loadingItem.querySelectorAll('progress')[0];
        loadingItem.removeChild(progress);
        loadingItem.classList.add('error');
        loadingItem.onclick = function () { alert(message); };
    });
}


function deleteImage(hash, deletehash) {
    var elem = document.getElementById(hash);

    progress = $$('progress');

    elem.appendChild(progress);
    var links = elem.querySelectorAll('a');
    elem.removeChild(links[0]);
    elem.removeChild(links[1]);

    elem.classList.add('loading');
    if (CurrentAlbum == "_thisComputer") {
        model.unsorted.deleteImage(deletehash).addEventListener('EVENT_COMPLETE', function (e) {
            if (elem) {
                elem.parentNode.removeChild(elem);
            }
        });
    } else {
        elem.style.cursor = 'progress';
        model.authenticated.deleteImage(deletehash).addEventListener('EVENT_COMPLETE', function (e) {
            if (elem) {
                elem.style.cursor = 'default';
                elem.parentNode.removeChild(elem);
            }
        });
    }
}

function resizeImage(img, maxh, maxw) {

    var maxh = 180,
        maxw = 180;
    var ratio = maxh/maxw;
    if (img.height/img.width > ratio){
        if (img.height > maxh){
            img.width = Math.round(img.width*(maxh/img.height));
            img.height = maxh;
        }
    } else {
        if (img.width > maxh){
            img.height = Math.round(img.height*(maxw/img.width));
            img.width = maxw;

        }
    }

    img.style.top = (200 - img.height) / 2 + 'px';
    img.style.left = (200 - img.width) / 2 + 'px';
};

function makeAlbumItem(imageItem) {

    var li = $$('li'),
        img = $$('img'),
        del = $$('a'),
        copy = $$('a'),
        edit = $$('a'),
		download = $$('a'),
        copyInput = $$('input');

    del.href = copy.href = "#";
    del.innerHTML = "delete";
    del.classList.add('image-delete');
    del.onclick = function (e) {
        e.preventDefault();
        if (del.innerHTML == 'sure?') {
            deleteImage(imageItem.image.hash, imageItem.image.deletehash);
        } else {
            del.innerHTML = 'sure?';
        }

    };

    copy.innerHTML = "copy link";
    copy.classList.add('image-copy');
    copy.onclick = function (e) {
        e.preventDefault();
        copyInput.select();
        document.execCommand("Copy");
        var copyNotification = $$('span');

        copyNotification.innerHTML = 'copied';
        copyNotification.classList.add('copy-notification');
        li.appendChild(copyNotification);
        setTimeout(function () {
            li.removeChild(copyNotification);
        }, 1000);
    };

    copyInput.type = 'text';
    copyInput.value = imageItem.links.original;

    li.classList.add('loading');

    img.style.display = 'none';
    img.id = 'image-' + imageItem.image.hash;

    img.onload = function () {
    	resizeImage(this);
    	if (!imageItem.image.animated && model.preferences.get('freezegifs')) {
    		var canvas = $$('canvas');
    		canvas.width = this.width;
    		canvas.height = this.height;
    		canvas.style.top = this.style.top;
    		canvas.style.left = this.style.left;
    		canvas.id = this.id;
    		canvas.getContext('2d').drawImage(this, 0, 0);
    		canvas.onclick = img.onclick;
    		li.replaceChild(canvas, img);
    	}
    	li.classList.remove('loading');
    	img.style.display = 'block';
    };

    img.onclick = function () {
        chrome.tabs.create({ "url": imageItem.links.original, "selected": true });
    };

    img.src = imageItem.links.large_thumbnail;

    li.id = imageItem.image.hash;
	li.dataset.deletehash = imageItem.image.deletehash;

    edit.href = "#";
    edit.innerHTML = "edit a copy";
    edit.classList.add('image-edit');
    edit.onclick = function (e) {
    	e.preventDefault();
    	if (!model.preferences.get('shownavairywarning')) {
    		model.preferences.set('shownavairywarning', true)
    		if (!confirm("This launches the Aviary image editor. Unfortunately right now they store a copy of your image on their server that you can't delete. If you're OK with that, go right ahead, otherwise cancel")) {
    			return;
    		}
    	}
    	featherEditor.launch({
    		image: 'image-' + imageItem.image.hash,
    		url: imageItem.links.original
    	});
    }


    download.href = "#";
    download.innerHTML = "download";
    download.classList.add('image-download');
    download.onclick = function (e) {
    	e.preventDefault();
    	var existingIFrame = li.querySelectorAll('iframe')[0];
    	if (existingIFrame) {
    		li.removeChild(existingIFrame);
    	}

    	var iFrame = $$('iframe');
    	iFrame.src = "http://imgur.com/download/" + imageItem.image.hash;
    	li.appendChild(iFrame);

    };


    li.appendChild(copyInput);
    li.appendChild(img);
    li.appendChild(del);
    li.appendChild(copy);
    li.appendChild(edit);
    li.appendChild(download);

    return li;

}

function makeLoadingItem(image) {
    var li = $$('li'),
        progress = $$('progress');

    progress.setAttribute('min', '0');
    progress.setAttribute('max', '100');
    
    li.appendChild(image);
    li.appendChild(progress);
    li.classList.add('loading');

    return li;
}

function convertLoadingToAlbum(loadingItem, fullItem) {
    loadingItem.parentNode.replaceChild(makeAlbumItem(fullItem), loadingItem);
}

function makeAlbum(album) {
    var div = $$('div'),
        ul = $$('ul');

    div.id = album.id;
    div.className = 'album';

    div.appendChild(ul);

    return div;

}

function changeAlbum(albumID) {
	hideStatusBar();
    if (albumID == '_newAlbum') {

        var albumTitle = prompt('Album title');

        if (albumTitle == "" || !albumTitle) {
            ENavSelect.value = CurrentAlbum;
        } else {
            model.authenticated.makeAlbum(albumTitle).addEventListener('EVENT_COMPLETE', function (album) {
                model.currentAlbum.set(album.id);
                window.location.reload();
            });
        }

        return;
    }

    model.currentAlbum.set(albumID);

    ENavSelect.value = albumID;

    if (ECurrentAlbum) {
        ECurrentAlbum.classList.remove('active');
    }

    CurrentAlbum = albumID;
    ECurrentAlbum = $(CurrentAlbum);
    ECurrentAlbum.classList.add('active');

    var ul = ECurrentAlbum.querySelectorAll('ul')[0];

    if (CurrentAlbum == "_thisComputer") {
        var images = model.unsorted.get();
        ul.innerHTML = "";
        if (images.length > 0) {
        	for (var i = 0; i < images.length; i++) {
        		ul.insertBefore(makeAlbumItem(images[i]), ul.firstChild);
        	}
        } else {
			showStatusBar("You have no images in this album. You can drag and drop images onto this page or print screen and paste straight onto this page to upload your images.");
        }
    } else if (CurrentAlbum == "_userAlbum") {
        document.body.style.cursor = 'progress';
        model.authenticated.fetchUserImages().addEventListener('EVENT_COMPLETE', function (images) {
            document.body.style.cursor = 'default';
            ul.innerHTML = "";
            if (images) {
                for (var i = 0; i < images.length; i++) {
                    ul.insertBefore(makeAlbumItem(images[i]), ul.firstChild);
                }
            }
        });
    } else {
        document.body.style.cursor = 'progress';
        var noImages = ECurrentAlbum.querySelectorAll('.no-images')[0];
        model.authenticated.fetchAlbumImages(CurrentAlbum).addEventListener('EVENT_COMPLETE', function() {
            document.body.style.cursor = 'default';
            ul.innerHTML = "";
        }).addEventListener('EVENT_SUCCESS', function (images) {
            for (var i = 0; i < images.length; i++) {
                ul.insertBefore(makeAlbumItem(images[i]), ul.firstChild);
            }
        }).addEventListener('EVENT_ERROR', function (message) {
        	showStatusBar("You have no images in this album. You can drag and drop images onto this page or print screen and paste straight onto this page to upload your images.");

        });
    }

}

function showStatusBar(text, showClose) {
	EStatusBar.querySelectorAll('.content')[0].innerHTML = text;
	if (showClose) {
		EStatusBarLink.style.display = "block";
	} else {
		EStatusBarLink.style.display = "none";
	}
	EStatusBar.classList.add('show');
}

function hideStatusBar() {
	EStatusBar.classList.remove('show');
}

function initAuthenticated() {
    ENavConnect.classList.add('hide');
    ENavSelect.classList.remove('hide');
    var albums = model.authenticated.getAlbums();

    var unsortedOpt = $$('option');
    unsortedOpt.value = '_thisComputer';
    unsortedOpt.text = '- this computer -';
    ENavSelect.appendChild(unsortedOpt);

    var defaultAlbumOpt = $$('option');
    defaultAlbumOpt.value = '_userAlbum';
    defaultAlbumOpt.text = model.authenticated.getAccount().url;
    ENavSelect.appendChild(defaultAlbumOpt);

    var EUserAlbum = makeAlbum(makeAlbum({ id: '_userAlbum' }));
    EAlbums.appendChild(EUserAlbum);

    if (albums) {
        for (var i = 0; i < albums.length; i++) {

            var EAlbum = makeAlbum(albums[i]);

            var opt = $$('option');
            opt.value = albums[i].id;
            opt.text = albums[i].title || "(Untitled Album)";

            ENavSelect.appendChild(opt);
            EAlbums.appendChild(EAlbum);
        }
    }

    var newAlbumOpt = $$('option');
    newAlbumOpt.value = '_newAlbum';
    newAlbumOpt.text = '<New Album>';
    ENavSelect.appendChild(newAlbumOpt);

}

port.onMessage.addListener(function (msg) {
    // Only gets one message
    window.location.reload();
});

window.onload = function () {

	EAlbums = $('albums');
	EWrap = $('wrap');
	ENav = document.getElementsByTagName('nav')[0];
	ENavConnect = $('nav-connect');
	ENavDownload = $('nav-download');
	ENavDelete = $('nav-delete');
	ENavSelect = $('nav-albums');
	ENavOptions = $('nav-options');
	ENavAbout = $('nav-about');
	EStatusBar = $('status-bar');
	EStatusBarLink = EStatusBar.querySelectorAll('span')[0];

	document.documentElement.ondrop = function (e) {
		uploadFiles(e);
		hideStatusBar();
	};

	document.documentElement.ondragenter = function (e) {
		e.dataTransfer.dropEffect = 'copy';
		e.preventDefault();
		return false;
	};

	document.documentElement.ondragover = function (e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
		showStatusBar("Drop images to upload");
		return false;
	};

	document.documentElement.ondragexit = document.documentElement.ondragleave = function (e) {
		hideStatusBar();
		return false;
	};


	document.documentElement.onpaste = function (e) {
		var items = e.clipboardData.items;
		for (var i = 0; i < items.length; ++i) {
			if (items[i].kind == 'file' && items[i].type == 'image/png') {
				var blob = items[i].getAsFile();

				var reader = new FileReader();
				reader.onload = function (e) {
					makeItem(e.target.result);
				}
				reader.readAsDataURL(blob);

			}
		}
	};

	ENavConnect.onclick = function () {
		ENavConnect.onclick = null;
		ENavConnect.innerHTML = '<progress />';
		ENavConnect.style.cursor = 'progress';
		port.postMessage({ Name: "get_user" });
	};

	ENavSelect.onchange = function () {
		changeAlbum(this.value);
	};

	ENavOptions.onclick = function () {
		if (document.querySelectorAll('.loading').length > 0) {
			chrome.tabs.create({ "url": "options.html", "selected": true });
		} else {
			window.location = "options.html";
		}
	};

	ENavDownload.onclick = function (e) {
		e.preventDefault();
		var downloadLinks = ECurrentAlbum.querySelectorAll('.image-download');

		var evObj = document.createEvent('MouseEvents');
		evObj.initEvent('click', true, false);

		for (var i = 0; i < downloadLinks.length; i++) {
			downloadLinks[i].dispatchEvent(evObj);
		}

	}

	ENavDelete.onclick = function (e) {
		e.preventDefault();

		if(confirm("Are you sure you want to delete all images in this album?")) {

			var images = ECurrentAlbum.querySelectorAll('li');

			for (var i = 0; i < images.length; i++) {
				deleteImage(images[i].id, images[i].dataset.deletehash)
			}

		}

		

	}

	ENavAbout.onclick = function () {
		if (document.querySelectorAll('.loading').length > 0) {
			chrome.tabs.create({ "url": "about.html", "selected": true });
		} else {
			window.location = "about.html";
		}
	};

	EStatusBarLink.addEventListener('click', function (e) {
		hideStatusBar();
	});

	EAlbums.appendChild(makeAlbum({ id: '_thisComputer' }));

	if (model.authenticated.OAuthManager.GetAuthStatus()) {
		initAuthenticated();
	} else {
		ENavConnect.classList.remove('hide');
	}
	changeAlbum(model.currentAlbum.get());

};

