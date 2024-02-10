function promptFile() {
	filePath = window.api.callSync("promptFile");
	if (filePath.length > 0) {
		_filePathDisplay.textContent = filePath;
	}
}

const mutationObserver = new MutationObserver((mutationList, observer) => {
	for (const mutation of mutationList) {
		if (mutation.type === "attributes") {
			if (mutation.attributeName === "class") {
				if (mutation.target.className.includes("hide")) {
					mutation.target.remove();
				}
			}
		}
	}
})

function logToast(message, color, delay) {
	if (!delay) delay = 1000;
	let newDiv = document.createElement("div");
	newDiv.innerHTML = `<div class="toast-header">
	<svg class="bd-placeholder-img rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice" focusable="false"><rect width="100%" height="100%" fill="#${color}"/></svg>
	<strong class="me-auto">MangDownloader</strong>
	<small class="text-muted">just now</small>
	<button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
</div>
<div class="toast-body">
	${message}
</div>`;
	newDiv.setAttribute("class", "toast");
	newDiv.setAttribute("role", "alert");
	newDiv.setAttribute("aria-live", "assertive");
	newDiv.setAttribute("aria-atomic", "true");
	toastContainer.appendChild(newDiv);
	let toast = new bootstrap.Toast(newDiv, { delay: delay });
	mutationObserver.observe(newDiv, {
		attributes: true,
		attributeFilter: ["class"],
		childList: false,
		characterData: false
	})
	toast.show();
}

let adding = false;

function reEnable() {
	adding = false;
	addBtn.removeAttribute("disabled");
}

function addSource() {
	if (!adding) {
		_title.value = _title.value.trim();
		_nameConv.value = _nameConv.value.trim();
		_rootElementFeed.value = _rootElementFeed.value.trim();
		_listElementFeed.value = _listElementFeed.value.trim();
		_imageElementFeed.value = _imageElementFeed.value.trim();
		_sourceElementFeed.value = _sourceElementFeed.value.trim();
		_urlPrefix.value = _urlPrefix.value.trimStart();
		const title = _title.value;
		const nameConv = _nameConv.value;
		const rootElementFeed = _rootElementFeed.value;
		const listElementFeed = _listElementFeed.value;
		const imageElementFeed = _imageElementFeed.value;
		const sourceElementFeed = _sourceElementFeed.value;
		const urlPrefix = _urlPrefix.value;
		if (title.length > 0 && nameConv.length > 0 && rootElementFeed.length > 0 && listElementFeed.length > 0 && imageElementFeed.length > 0 && sourceElementFeed.length > 0 && filePath != undefined) {
			adding = true;
			addBtn.setAttribute("disabled", "");
			logToast("Adding source", "FF8500");
			setTimeout(() => {
				window.api.call("appendSource", {
					"title": title,
					"naming": nameConv,
					"rootFeed": rootElementFeed,
					"listFeed": listElementFeed,
					"imgFeed": imageElementFeed,
					"srcFeed": sourceElementFeed,
					"filePath": filePath,
					"urlPrefix": urlPrefix
				}, "appendedSource", (event, addResult) => {
					console.log(addResult);
					//logToast(!addResult.error ? "Added source" : `Error : ${addResult.errorMessage}`, !addResult.error ? "007aff" : "ff3000", 1200);
					if (addResult.error) {
						logToast(`Error : ${addResult.errorMessage}`, "ff3000", 1200);
						reEnable();
						return;
					}
					loadingModal.show();
				})
			}, 1000)
		} else {
			logToast("Edit the necessary fields!", "FF8500");
		}
	}
}

window.api.on("addedSource", (event, err) => {
	loadingModal.hide();
	logToast(err ? `Failed adding source : ${err}` : "Added source", err ? "ff3000" : "007aff", err ? 5000 : 1200);
	if (!err) {
		setTimeout(() => {
			window.location.href = "./";
		}, 1200);
	} else {
		reEnable();
	}
})

//007aff
/*
setInterval(() => {
	logToast("Hello world", "00ff05", 1500);
}, 1000);
*/

window.api.on("progress", (event, args) => {
	finIndicator.textContent = `Sources finished: ${args[0]} / ${args[1]}`;
	let prog = args[0] / args[1] * 100;
	progressBar.style.width = prog + "%";
	progressBar.textContent = Math.floor(prog) + "%";
})

const _title = document.getElementById("title");
const _nameConv = document.getElementById("nameConv");
const _rootElementFeed = document.getElementById("rootElementFeed");
const _listElementFeed = document.getElementById("listElementFeed");
const _imageElementFeed = document.getElementById("imageElementFeed");
const _sourceElementFeed = document.getElementById("sourceElementFeed");
const _urlPrefix = document.getElementById("urlPrefix");
let filePath;
let _filePathDisplay = document.getElementById("filePathDisplay");
const toastContainer = document.getElementById("toast-container");
const addBtn = document.getElementById("addBtn");
addBtn.onclick = addSource;
const loadingModal = new bootstrap.Modal(document.getElementById("loading-modal"));
const finIndicator = document.getElementById("finIndicator");
const progressBar = document.getElementById("progressBar");