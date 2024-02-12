//const titleText = document.getElementById("titleText");

function isBase64(str) {
	try {
		atob(str);
		return true;
	} catch(e) {
		return false;
	}
}

const tooltipTriggerList = document.querySelectorAll(`[data-bs-toggle="tooltip"]`)
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
const modalInfo = document.getElementById("modalInfo");
const msgModalDom = document.getElementById("msgModal");
const msgModal = new bootstrap.Modal(msgModalDom);
const modInput = document.getElementById("modInput");
const editBtn = document.getElementById("editBtn");

function editqueue() {
	if ((modInput.value = modInput.value.trim()).length > 0) {
		editBtn.disabled = true;
		modalInfo.innerHTML = "Queuing...";
		msgModal.show();
		window.api.send("editQuery", { id: params.id, editData: modInput.value });
	}
}

if (runQueryCheck() && isBase64(params.title)) {
	document.getElementById("redirectAnchor").href = `./reader_menu.html?id=${params.id}`;
	document.getElementById("editTitle").textContent = atob(params.title);
	//titleText.textContent = params.id;
	console.log(params.id);

	window.api.on("failQuery", (event, args) => {
		console.log("well shit");
		// this is what you bitches get for tampering with stuff you don't understand smh, it's taken me like 7 hours to add this feature
		window.alert("A fatal error has occured in the edit query process, this is bad for a lot of reasons:\n- This database may be corrupted\n- This source may not work again if the database has been corrupted\n- The program may not work properly\nPlease understand what you're doing before fiddling with this operation\n(unless you are a developer or something)\n\nNOTE: This program is still buggy and in its beta stages. Ask a dev for further solutions or workarounds that you may need to do if the database has been corrupted!");
		setTimeout(() => {
			msgModal.hide();
		}, 2000)
	})
	
	window.api.on("successQuery", (event, args) => {
		window.location.href = `./reader_menu.html?id=${params.id}`;
	})

	window.api.on("message", (event, msg) => {
		modalInfo.innerHTML = msg;
	})
} else {
	window.location.href = failLocation;
}

modInput.addEventListener("keyup", function() {
	this.style.overflow = 'hidden';
	this.style.height = 0;
	this.style.height = this.scrollHeight + 'px';
}, false);