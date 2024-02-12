const chapSelector = document.getElementById("chapSelector");
const chapDummy = document.getElementById("chapDummy");
const imglist = document.getElementById("imglist");
const titleText = document.getElementById("titleText");
const bottomTool = document.getElementById("bottomTool");
const navloadIndicator = document.getElementById("navloadIndicator");
const loadIndicator = document.getElementById("aloadIndicator");
const pB1 = document.getElementById("pB1");
const pB2 = document.getElementById("pB2");
const pB3 = document.getElementById("pB3");
const pB4 = document.getElementById("pB4");

let initialized = false;

let prev = () => {};
let next = () => {};

function init() {
	if (runQueryCheck()) {
		document.getElementById("backLink").href = `./reader_menu.html?id=${params.id}`;
		document.getElementById("backLinkDummy").href = document.getElementById("backLink").href;
		window.api.call("getFull", params.id, "receiveFull", (event, mangaInfo) => {
			let fullData = mangaInfo.listData;
			let vol = parseFloat(params.vol);
			let chap = params.chap;
			function getVi(vVal) {
				return fullData.map(chapters => chapters[0]).indexOf(vVal);
			}
			function getVolData(vi) {
				return fullData[vi][1].map(chapArr => chapArr[1]);
			}
			if (typeof(chap) !== "string") {
				chap = getVi(vol);
				if (chap < 0) {
					window.location.href = failLocation;
					return;
				}
				chap = fullData[chap][1][0][1].toString();
			}
			chap = parseFloat(chap);
			fullData.forEach(chapters => {
				let htmlOutput = `<optgroup label="Volume ${chapters[0]}">`;
				chapters[1].forEach(chapter => {
					htmlOutput += `<option ${chap == chapter[1] ? "selected " : ""}value="${chapter[1]}">Chapter ${chapter[1]}</option>`;
				})
				htmlOutput += `</optgroup>`;
				chapSelector.innerHTML += htmlOutput;
			})
			chapDummy.innerHTML = chapSelector.innerHTML;
			chapSelector.onchange = (evt) => {
				window.location.href = `./reader.html?id=${params.id}&chap=${chapSelector.value}`;
			}
			chapDummy.onchange = (evt) => {
				chapSelector.value = chapDummy.value;
				chapSelector.onchange(evt);
			}
			titleText.textContent = mangaInfo.title;
			let curVol;
			let chapters;
			for (i = 0; i < fullData.length; i++) {
				chapters = fullData[i];
				if (chapters[1].filter(chapArr => chapArr[1] == chap).length > 0) {
					curVol = chapters[0];
					break;
				}
			}
			if (typeof(curVol) === "number") vol = curVol
			//console.log(vol);
			let loadFinished = false;
			window.api.on("finishedLoading", (event, args) => {
				if (!loadFinished) {
					if (args.error) {
						loadIndicator.textContent = args.errorMessage;
						return;
					}
					loadFinished = true;
					navloadIndicator.remove();
					bottomTool.classList.remove("d-none");
				}
			})
			window.api.on("loadImage", (event, args) => {
				if (!loadFinished) {
					//console.log(args);
					loadIndicator.textContent = `Loaded ${args.i + 1} / ${args.len}`;
					imglist.innerHTML += `<img src="${args.path}" class="my-1 img-fluid w-100 h-auto p-0 m-0" loading="lazy" alt="">`;
				}
			})

			window.api.send("initializeImages", {
				id: params.id,
				vol: curVol,
				chap
			})

			//console.log("a");
			
			let vi = getVi(vol);
			let vLen = fullData.length;
			let volData = getVolData(vi);
			let ci = volData.indexOf(chap);
			let cLen = volData.length;
			let toDisable = [ci == 0 && vi == 0, ci + 1 >= cLen && vi + 1 >= vLen];

			if (toDisable[0]) {
				pB1.setAttribute("disabled", "");
				pB2.setAttribute("disabled", "");
			} else {
				prev = () => {
					let urlForge = `./reader.html?id=${params.id}&chap=`;
					if (ci == 0) {
						let cinfo = fullData[vi - 1][1];
						urlForge += cinfo[cinfo.length - 1][1];
					} else {
						urlForge += volData[ci - 1];
					}
					window.location.href = urlForge;
				}
			}

			if (toDisable[1]) {
				//console.log("a");
				nB1.setAttribute("disabled", "");
				nB2.setAttribute("disabled", "");
			} else {
				next = () => {
					let urlForge = `./reader.html?id=${params.id}&chap=`;
					if (ci + 1 >= cLen) {
						urlForge += fullData[vi + 1][1][0][1];
					} else {
						urlForge += volData[ci + 1];
					}
					window.location.href = urlForge;
				}
			}

			initialized = true;
		})
	} else {
		window.location.href = failLocation;
	}
}

init();