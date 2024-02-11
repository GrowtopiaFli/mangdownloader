const downModalDom = document.getElementById("downModal");
const downModal = new bootstrap.Modal(downModalDom);
const imgModIndicator = document.getElementById("imgModIndicator");
const dwnModIndicator = document.getElementById("dwnModIndicator");
const pBar1 = document.getElementById("pBar1");
const pBar2 = document.getElementById("pBar2");
const volIndicate = document.getElementById("volIndicate");

function read(volId) {
	window.location.href = `./reader.html?id=${params.id}&vol=${volId}`;
}

function download(volId, vi) {
	volIndicate.textContent = `Volume ${volId}`;
	window.api.send("startVolumeCaching", { id: params.id, vi });
}

function reInit() {
	volIndicate.textContent = `Volume -`;
	imgModIndicator.text = "[...]";
	dwnModIndicator.text = "Chapters...";
	pBar1.style.width = "0%";
	pBar2.style.width = "0%";
}

function dismissal() {
	window.api.send("cancelVolumeCaching", "");
	reInit();
}

window.api.on("cProgress", (event, args) => {
	//console.log(args);
	dwnModIndicator.textContent = `Cached Chapters ${args[0]} / ${args[1]}`;
	pBar2.style.width = `${args[0] / args[1] * 100}%`;
})

window.api.on("cEnd", (event, args) => {
	if (modalVisible) downModal.hide();
	reInit();
})

window.api.on("imageProg", (event, args) => {
	imgModIndicator.textContent = `[Image ${args.i} / ${args.len}]`;
	pBar1.style.width = `${args.i / args.len * 100}%`;
})

let modalVisible = false;

downModalDom.addEventListener("show.bs.modal", () => {
	modalVisible = true;
})

downModalDom.addEventListener("hide.bs.modal", () => {
	modalVisible = false;
})

if (runQueryCheck()) {
	window.api.call("getVolumes", params.id, "receiveVolumes", (event, volumeInformation) => {
		if (Object.keys(volumeInformation).length === 0) {
			window.location.href = failLocation;
		} else {
			const spinner = document.getElementById("spinner");
			spinner.remove();
			const titleText = document.getElementById("titleText");
			titleText.textContent = volumeInformation.title;
			let html = `<table class="table table-hover my-3">
	<thead>
		<tr>
			<th class="col-10">Label</th>
			<th class="col-2">Action</th>
		</tr>
	</thead>
	<tbody id="dataInsertion" class="ignoreWrap">
	</tbody>
</table>`;
			const newElements = document.createElement("div");
			document.body.appendChild(newElements);
			newElements.innerHTML = html;
			const dataInsertion = document.getElementById("dataInsertion");
			volumeInformation.volumes.forEach((volId, vi) => {
				dataInsertion.innerHTML += `<tr class="my-3">
	<td class="col-10">Volume ${volId}</td>
	<td class="col-2">
		<button class="btn btn-secondary" onclick="read(${volId})"><i class="bi bi-book-half"></i></button>
		<button class="btn btn-secondary" onclick="download(${volId}, ${vi})" data-bs-toggle="modal" data-bs-target="#downModal"><i class="bi bi-arrow-down"></i></button>
	</td>
</tr>`;
			})
			document.getElementById("editListBtn").onclick = () => {window.location.href = `./listedit.html?id=${params.id}&title=${btoa(volumeInformation.title)}`};
		}
	})
} else {
	window.location.href = failLocation;
}