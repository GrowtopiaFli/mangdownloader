const warnText = document.getElementById("warnText");
const permDel = document.getElementById("permDel");
const delBtn = document.getElementById("delBtn");
const delModalDom = document.getElementById("delModal");
const delModal = new bootstrap.Modal(delModalDom);

let queuing = false;

function queueDel(delId) {
	delBtn.disabled = true;
	if (!queuing) {
		queuing = true;
		window.api.send("deleteSource", delId);
	}
}

window.api.on("sourceDeleted", (event, args) => {
	location.href = "./";
})

function redirectAdd() {
	window.location.href = "./add.html";
}

const dataInsertion = document.getElementById("dataInsertion");
function appendData(a, b) {
	let tr = document.createElement("tr");
	dataInsertion.appendChild(tr);
	tr.setAttribute("class", "my-3");
	let td1 = document.createElement("td");
	td1.setAttribute("class", "col-6");
	tr.appendChild(td1);
	td1.textContent = a;
	let td2 = document.createElement("td");
	td2.setAttribute("class", "col-4");
	tr.appendChild(td2);
	td2.textContent = b;
	let td3 = document.createElement("td");
	td3.setAttribute("class", "col-2");
	tr.appendChild(td3);
	let btn1 = document.createElement("button");
	btn1.setAttribute("class", "btn btn-secondary");
	btn1.setAttribute("onclick", `window.location.href = "./reader_menu.html?id=${b}"`);
	td3.appendChild(btn1);
	let i1 = document.createElement("i");
	i1.setAttribute("class", "bi bi-book");
	btn1.appendChild(i1);
	td3.innerHTML += "\n";
	let btn2 = document.createElement("button");
	btn2.setAttribute("class", "btn btn-secondary");
	btn2.onclick = () => {
		delBtn.setAttribute("onclick", `queueDel("${b}")`)
		permDel.checked = false;
		warnText.innerHTML = `You are about to <b>PERMANENTLY</b> delete this source.<br>Source: <b>${a}</b>`;
		console.log("delete");
		//window.location.href = `./edit.html?id=${b}`;
	}
	td3.appendChild(btn2);
	let i2 = document.createElement("i");
	i2.setAttribute("class", "bi bi-trash");
	btn2.appendChild(i2);
	
	btn2.setAttribute("data-bs-toggle", "modal");
	btn2.setAttribute("data-bs-target", "#delModal");
	let ht2 = btn2.outerHTML;
}

//appendData("Some weird name", "31a25847-146f-4614-9cad-46e3698e6b65");

const tableData = window.api.callSync("tableData");
tableData.forEach((arr) => {
	appendData(arr[1], arr[0]);
})