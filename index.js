import { dialog, app, BrowserWindow, ipcMain, Tray, Menu } from "electron";
import fs from "node:fs";
import { rm } from "node:fs/promises";
import express from "express";
import http from "node:http";
import https from "node:https";
import { Level } from "level";
import crypto from "node:crypto";
import path from "node:path";
//import { JSDOM } from "jsdom";
import { parse } from "node-html-parser";
//import { validateMIMEType } from "validate-image-type";
import { readChunk } from "read-chunk";
import imageType, { minimumBytes } from "image-type";
import url from "node:url";
//	import nthline from "nthline";
import evaluate from "safe-evaluate-expression";
import notifier from "node-notifier";
//import { release } from "node:os";
//import regedit from "regedit";
//import cp from "node:child_process";
//import getPath from "platform-folders";

//const shellFolders = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders";
//const docsVal = "Personal";
const dataFol = "./MangDownloader";
//const dataFolders = ["./MangDownloader", "resources/data"];
const idRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

dialog.showErrorBox = function(title, content) {
    console.log(`${title}\n${content}`);
};

let executors = [];
let executing;

let isSingleInstance = app.requestSingleInstanceLock()
if (isSingleInstance) {
	const host = "127.0.0.1";

	function relativeToAbsolute(relPath) {
		return url.fileURLToPath(new URL(relPath, import.meta.url));
	}

	function folderRecurse(folPath) {
		let folExisting = fs.existsSync(folPath);
		if (folExisting) folExisting = fs.statSync(folPath).isDirectory();
		if (!folExisting) fs.mkdirSync(folPath, { recursive: true });
		return folPath;
	}

	let dataFolder = path.join(app.getPath("documents"), dataFol);
	console.log(dataFolder);
	/*
	let tmpFolder = app.getPath("documents");
	if (tmpFolder )
	regedit.list(shellFolders, (regErr, regResult) => {
		if (regErr) {
			dataFolder = dataFolders[1];
			progInit();
			return;
		}

		// Object.values(regResult)[0].values[docsVal].value
		let res = "%USERPROFILE%\\Documents";
		dataFolder = cp.execSync(`cmd /c echo ${path.join(res, dataFolders[0])}`).toString().replaceAll("\r", "").replaceAll("\n", "");
		console.log(dataFolder);
		console.log(app.getPath("documents"));

		progInit();
	});
	*/

	folderRecurse(dataFolder);
	const db = new Level(`${dataFolder}/db`);
	const cacheFolder = `${dataFolder}/cache`;
	folderRecurse(cacheFolder);

	function pushNotify(msg, snd, time) {
		if (typeof(snd) !== "boolean") snd = false;
		if (typeof(time) !== "number") time = 3;
		notifier.notify({
			title: "MangDownloader",
			message: msg,
			icon: "resources/icons/md.ico",
			sound: snd,
			wait: false,
			timeout: time,
			reply: false,
			closeLabel: undefined,
			actions: undefined,
			dropdownLabel: undefined,
			open: undefined,
			subtitle: undefined,
			appId: "com.gwebdev.mangdownloader"
		});
	}

	function pad(inp, n) {
		let og = Math.floor(inp).toString();
		let out = "" + og;
		while (out.length < n) out = "0" + out;
		return out + inp.toString().substring(og.length);
	}

	//const evaluate = factory({ operators: { pad: pad }, translateLogical: true });

	function genRandomId() {
		return new Promise((resolve, reject) => {
			db.keys().all().then((keys) => {
				let fin = false;
				let uid;
				while (!fin) {
					uid = crypto.randomUUID();
					if (!keys.includes(uid)) {
						fin = true;
					}
				}
				resolve(uid);
			}).catch((err) => {
				reject(err);
			});
		});
	}

	let html;

	function getHttpLib(httpUrl) {
		if (httpUrl.startsWith("http:")) return http;
		return https;
	}

	function scrapeSources(httpUrl, parA, parB, parC, parD) {
		return new Promise((resolve, reject) => {
			//console.log("SCRAPING ", httpUrl);
			const lib = getHttpLib(httpUrl);
			html = [];
			lib.get(httpUrl, (resp) => {
				//let html = [];
				resp.on("data", chunk => {
					html.push(chunk);
				});
				resp.on("end", () => {
					if (resp.statusCode != 200) {
						//console.log("FATAL FLAW DETECTED! PLEASE PROVIDE VALID SOURCES AS MUCH AS POSSIBLE, ISSUES ARISE WITH INVALID SOURCES/URLS, IGNORING THIS PROBLEM AND PROCEEDING OPERATIONS");
						pushNotify("FATAL FLAW DETECTED! PLEASE PROVIDE VALID SOURCES AS MUCH AS POSSIBLE, ISSUES ARISE WITH INVALID SOURCES/URLS, IGNORING THIS PROBLEM AND PROCEEDING OPERATIONS", true);
						resolve([]);
						return;
					}
					//let htmlStr = Buffer.concat(html).toString("utf8");
					//console.log(htmlStr);
					//console.log(resp);
					//console.log("oke");
					//html = Buffer.concat(html).toString();
					//const document = parse(html);
					//const doc = (new JSDOM(htmlStr)).window.document;
					//console.log(doc);
					try {
						const document = parse(Buffer.concat(html).toString());
						let figList = document.querySelector(parA).querySelectorAll(parB);
						let sources = [];
						for (let i = 0; i < figList.length; i++) {
							let im = figList[i];
							if (parC != "_") im = im.querySelector(parC);
							sources.push(im.getAttribute(parD));
						}
						sources = sources.filter(a => a != null).map(a => a.trim());
						resolve(sources);
					} catch(e) {
						//console.log(e);
						//console.log(resp);
						//console.log(httpUrl);
						//console.log(resp.statusCode);
						//console.log(resp.headers);
						pushNotify(`Doc parse failed: code - ${resp.statusCode}, uri - ${httpUrl} ; ${e.toString()}`, true);
						reject(e);
					}
				});
			}).on("error", err => {
				//console.log(err);
				reject("CONNERR");
			})
		})
	}

	function fetchIdPaths(id) {
		let paths = {};
		paths.root = folderRecurse(path.join(cacheFolder, id));
		paths.images = folderRecurse(path.join(paths.root, "img"));
		paths.index = folderRecurse(path.join(paths.root, "index"));
		paths.volumes = path.join(paths.index, "volume_data.txt");
		paths.meta = path.join(paths.index, "meta.txt");
		paths.volume = (n) => {
			let volumePaths = {};
			volumePaths.root = folderRecurse(path.join(paths.index, `v${n}`));
			volumePaths.images = folderRecurse(path.join(paths.images, `v${n}`));
			volumePaths.chapterinfo = path.join(volumePaths.root, "chapter_info.txt");
			volumePaths.sizemeta = path.join(volumePaths.root, "sizemeta.txt");
			return volumePaths;
		};
		return paths;
	}

	let chapterInfo;
	let passed;

	function scrapeVolume(iteration, event, totalLength, urlPrefix, chapList, len, parA, parB, parC, parD) {
		return new Promise((resolve, reject) => {
			event.sender.send("progress", [passed, totalLength]);
			if (iteration >= len) {
				resolve("");
				return;
			}
			scrapeSources(`${urlPrefix}${chapList[iteration]}`, parA, parB, parC, parD).then((sources) => {
				chapterInfo.push(sources);
				passed++;
				scrapeVolume(iteration + 1, event, totalLength, urlPrefix, chapList, len, parA, parB, parC, parD).then(() => {
					resolve("");
				})
			}).catch((eData) => {
				if (eData === "CONNERR") {
					scrapeVolume(iteration, event, totalLength, urlPrefix, chapList, len, parA, parB, parC, parD).then(() => {
						resolve("");
					})
				} else {
					reject(eData);
				}
			})
		})
	}

	/*
	function scrapeVolume(meta, listData, curVol) {
		return new Promise((resolve, reject) => {
			let volumePaths = 
			scrapeVolume().then((_) => {
				resolve(_);
			}).catch((err) => {
				reject(err);
			})
		})
	}
	*/

	function sumArray(arr) {
		let t = 0;
		arr.forEach(n => {
			t += n;
		})
		return t;
	}

	function scrapeVolumes(paths, iteration, event, urlPrefix, listData, lengthData, vLength, parA, parB, parC, parD) {
		chapterInfo = [];
		let totalLength = sumArray(lengthData);
		return new Promise((resolve, reject) => {
			event.sender.send("progress", [iteration, vLength]);
			if (iteration >= vLength) {
				resolve("");
				return;
			}
			let volumePaths = paths.volume(listData[iteration][0]);
			scrapeVolume(0, event, totalLength, urlPrefix, listData[iteration][1].map(chap => chap[0]), lengthData[iteration], parA, parB, parC, parD).then(() => {
				//volumeInfo.push(chapterInfo);
				fs.writeFileSync(volumePaths.chapterinfo, chapterInfo.map(chap => chap.join("\n")).join("\n\n"));
				fs.writeFileSync(volumePaths.sizemeta, chapterInfo.map(chap => chap.length).join("\n"));
				scrapeVolumes(paths, iteration + 1, event, urlPrefix, listData, lengthData, vLength, parA, parB, parC, parD).then(() => {
					resolve("");
				})
			}).catch((dErr) => {
				reject(dErr);
			})
		})
	}

	function listDataToUrlData(listData) {
		return listData.map(chapters => [chapters[0], chapters[1].map(chap => chap[0])]);
	}

	function addSource(event, respMessage, title, naming, rootQuery, listQuery, imgQuery, srcQuery, listFilePath, urlPrefix) {
		genRandomId().then((id) => {
			//console.log("New ID : ", id);
			let paths = fetchIdPaths(id);
			//console.log(paths);
			let listData = fs.readFileSync(listFilePath).toString("utf8").replaceAll("\r", "");
			if (!listData.startsWith("GWEBLIST\n\n")) {
				event.sender.send(respMessage, {
					error: true,
					errorMessage: "List file invalid!"
				})
				return;
			}
			listData = listData.substring(10).split("\n\n").map(chapters => chapters.split("\n")).map(chapters => {
				let volLabel = parseFloat(chapters.splice(0, 1)[0]);
				chapters = chapters.map(chap => chap.split(tokenfilters.cformat)).filter(chap => chap.length == 2).map(chap => [chap[0], parseFloat(chap[1])]);
				return [volLabel, chapters];
			});
			let lengthData = listData.map(chapters => chapters[1].length);
			let meta = {
				title,
				naming,
				rootQuery,
				listQuery,
				imgQuery,
				srcQuery,
				urlPrefix
			}
			
			fs.writeFileSync(paths.meta, JSON.stringify(meta));
			fs.writeFileSync(paths.volumes, JSON.stringify(listData));
			// perform async job
			///console.log(listData);
			//console.log(meta);
			event.sender.send(respMessage, {
				error: false,
				errorMessage: ""
			})
			passed = 0;
			scrapeVolumes(paths, 0, event, meta.urlPrefix, listData, lengthData, lengthData.length, meta.rootQuery, meta.listQuery, meta.imgQuery, meta.srcQuery).then(() => {
				db.put(id, meta.title).then(() => {
					event.sender.send("addedSource", false);
				}).catch((err) => {
					//console.log("ERROR : ", err);
					//pushNotify("ERROR : " + err.toString(), true);
					event.sender.send("addedSource", err);
				})
			}).catch((dErr) => {
				//pushNotify("ERROR : " + dErr.toString(), true);
				event.sender.send("addedSource", dErr);
			})
		})
	}

	const validUrl = (s) => {
		try {
			new URL(s);
			return true;
		} catch (err) {
			return false;
		}
	};

	function fileExists(fPath) {
		let fExist = fs.existsSync(fPath);
		if (fExist) fExist = fs.statSync(fPath).isFile();
		return fExist;
	}

	function validExecution(event) {
		return executing == event.execId && executors.includes(event.execId);
	}

	function safeSend(event, a, b) {
		let elligible = validExecution(event);
		if (elligible) {
			event.sender.send(a, b);
			return true;
		}
		return false;
	}

	function releaseExecutor(event) {
		if (executors.includes(event.execId)) executors.splice(executors.indexOf(event.execId), 1);
	}

	function initIpcHandlers() {
		ipcMain.on("tableData", (event, args) => {
			db.iterator().all().then((dbData) => {
				event.returnValue = dbData;
			}).catch((err) => {
				console.warn("WARNING : THERE WAS AN ERROR WITH FETCHING tableData");
				console.error(err);
				event.returnValue = [];
			})
		})

		ipcMain.on("promptFile", (event, args) => {
			dialog.showOpenDialog({properties: ["openFile"]}).then((received) => {
				event.returnValue = received.canceled ? "" : received.filePaths[0];
			})
		})

		ipcMain.on("appendSource", (event, args) => {
			const respMessage = "appendedSource";
			try {
				evaluate(args.naming, { c: 0, v: 0, p: 0, pad });
				if (args.title.length > 0 && args.rootFeed.length > 0 && args.listFeed.length > 0 && args.naming.length > 0 && args.imgFeed.length > 0 && args.srcFeed.length > 0) {
					db.values().all().then((values) => {
						let titleExists = false;
						for (const value in values) {
							if (value == args.title) titleExists = true;
						}
						if (titleExists) {
							event.sender.send(respMessage, {
								error: true,
								errorMessage: "The source provided already exists!"
							})
							return;
						}
						let fExisting = fileExists(args.filePath);
						if (!fExisting) {
							event.sender.send(respMessage, {
								error: true,
								errorMessage: "List file not found!"
							})
							return;
						}
						if (!validUrl(args.urlPrefix)) {
							event.sender.send(respMessage, {
								error: true,
								errorMessage: "Invalid URL prefix!"
							})
							return;
						}
						addSource(event, respMessage, args.title, args.naming, args.rootFeed, args.listFeed, args.imgFeed, args.srcFeed, args.filePath, args.urlPrefix);
					})
				} else {
					event.sender.send(respMessage, {
						error: true,
						errorMessage: "Don't hack the system bud, the title = empty"
					})
				}
			} catch(e) {
				event.sender.send(respMessage, {
					error: true,
					errorMessage: "Naming convention invalid!"
				})
			}
		})

		ipcMain.on("getVolumes", (event, id) => {
			let respMessage = "receiveVolumes";
			let failedVal = {};
			if (id.search(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) == 0) {
				db.keys().all().then((keys) => {
					if (keys.includes(id)) {
						db.get(id).then((title) => {
							let paths = fetchIdPaths(id);
							try {
								let volInfo = JSON.parse(fs.readFileSync(paths.volumes)).map(chapters => chapters[0]);
								event.sender.send(respMessage, {
									title,
									volumes: volInfo
								})
							} catch(e) {
								fs.renameSync(paths.volumes, paths.volume + "broken");
								event.returnValue = failedVal;
							}		
						}).catch((err) => {
							event.sender.send(respMessage, failedVal);
						})
					} else {
						event.sender.send(respMessage, failedVal);	
					}
				}).catch((err) => {
					event.sender.send(respMessage, failedVal);
				});
			} else {
				event.sender.send(respMessage, failedVal);
			}
		})

		ipcMain.on("getFull", (event, id) => {
			let respMessage = "receiveFull";
			let failedVal = {};
			if (id.search(idRegex) == 0) {
				db.keys().all().then((keys) => {
					if (keys.includes(id)) {
						db.get(id).then((title) => {
							let paths = fetchIdPaths(id);
							try {
								let listData = JSON.parse(fs.readFileSync(paths.volumes));
								event.sender.send(respMessage, {
									title,
									listData
								})
							} catch(e) {
								fs.renameSync(paths.volumes, paths.volume + "broken");
								event.sender.send(respMessage, failedVal);
							}		
						}).catch((err) => {
							event.sender.send(respMessage, failedVal);
						})
					} else {
						event.sender.send(respMessage, failedVal);	
					}
				}).catch((err) => {
					event.sender.send(respMessage, failedVal);
				});
			} else {
				event.sender.send(respMessage, failedVal);
			}
		})
		
		ipcMain.on("initializeImages", (event, args) => {
			let execId = crypto.randomUUID();
			while (executors.includes(execId)) execId = crypto.randomUUID();
			event.execId = execId;
			executing = event.execId;
			executors.push(executing);
			const respMessage = "loadImage";
			const finMessage = "finishedLoading";
			const failedVal = {
				error: true,
				errorMessage: "The parameters are invalid"
			};
			if (args.id.search(idRegex) == 0) {
				db.keys().all().then((keys) => {
					if (keys.includes(args.id)) {
						db.get(args.id).then((title) => {
							let paths = fetchIdPaths(args.id);
							try {
								let listData = JSON.parse(fs.readFileSync(paths.volumes));
								let vi = listData.map(chapters => chapters[0]).indexOf(args.vol) ;
								if (vi >= 0) {
									let ci = listData[vi][1].map(chapArr => chapArr[1]).indexOf(args.chap);
									if (ci >= 0) {
										let metaData = JSON.parse(fs.readFileSync(paths.meta));
										let volumePaths = paths.volume(args.vol);
										let chaptersInf = fs.readFileSync(volumePaths.chapterinfo).toString("utf8").replaceAll("\r", "").split("\n\n").map(srcList => srcList.split("\n"));
										let sizeData = fs.readFileSync(volumePaths.sizemeta).toString("utf8").replaceAll("\r", "").split("\n").map(n => parseInt(n));
										let pageOffset = 0;
										for (let i = 0; i < ci - 1; i++) {
											pageOffset += sizeData[i];
										}
										let pLen = sizeData[ci];
										let srcList = chaptersInf[ci];
										let outputNames = [];
										for (let i = 0; i < pLen; i++) {
											let curPage = pageOffset + i;
											outputNames.push(evaluate(metaData.naming, { pad, title: metaData.title, v: args.vol, c: args.chap, p: curPage }));
										}
										loadImages(event, {
											i: 0,
											len: pLen,
											off: pageOffset,
											src: srcList,
											names: outputNames,
											chapUrl: `${metaData.urlPrefix}${listData[vi][1][ci][0]}`,
											params: [metaData.rootQuery, metaData.listQuery, metaData.imgQuery, metaData.srcQuery],
											paths,
											volumePaths,
											respMessage,
											chaptersInf
										}).then((newInf) => {
											if (validExecution(event)) {
												//console.log("yay");
												chaptersInf = newInf;
												fs.writeFileSync(volumePaths.chapterinfo, chaptersInf.map(chap => chap.join("\n")).join("\n\n"));
												fs.writeFileSync(volumePaths.sizemeta, chaptersInf.map(chap => chap.length).join("\n"));
												event.sender.send(finMessage, {
													error: false,
													len: pLen
												})
											}// else {
												//console.log("whoops, useless client");
											//}
											releaseExecutor(event);
										})
									} else {
										safeSend(event, finMessage, failedVal);
										releaseExecutor(event);
									}
								} else {
									safeSend(event, finMessage, failedVal);
									releaseExecutor(event);
								}
							} catch(e) {
								console.log(e);
								if (validExecution(event)) {
									fs.renameSync(paths.volumes, paths.volume + "broken");
									event.sender.send(finMessage, failedVal);
								}
								releaseExecutor(event);
							}		
						}).catch((err) => {
							safeSend(event, finMessage, failedVal);
							releaseExecutor(event);
						})
					} else {
						safeSend(event, finMessage, failedVal);
						releaseExecutor(event);
					}
				}).catch((err) => {
					safeSend(event, finMessage, failedVal);
					releaseExecutor(event);
				});
			} else {
				safeSend(event, finMessage, failedVal);
				releaseExecutor(event);
			}
		})

		ipcMain.on("cancelVolumeCaching", (event, args) => {
			executing = "";
			pushNotify("Download terminated", true, 1);
		})

		ipcMain.on("startVolumeCaching", (event, args) => {
			let execId = crypto.randomUUID();
			while (executors.includes(execId)) execId = crypto.randomUUID();
			event.execId = execId;
			executing = event.execId;
			executors.push(executing);
			const respMessage = "cProgress";
			const finMessage = "cEnd";
			const errMessage = "Error when caching volume; defective database?";
			//console.log(args);

			if (args.id.search(idRegex) == 0) {
				db.keys().all().then((keys) => {
					if (keys.includes(args.id)) {
						db.get(args.id).then((title) => {
							let paths = fetchIdPaths(args.id);
							try {
								let listData = JSON.parse(fs.readFileSync(paths.volumes));
								let metaData = JSON.parse(fs.readFileSync(paths.meta));
								let vol = listData[args.vi][0];
								let volumePaths = paths.volume(vol);
								let chaptersInf = fs.readFileSync(volumePaths.chapterinfo).toString("utf8").replaceAll("\r", "").split("\n\n").map(srcList => srcList.split("\n"));
								let sizeData = fs.readFileSync(volumePaths.sizemeta).toString("utf8").replaceAll("\r", "").split("\n").map(n => parseInt(n));
								/*
								let pageOffset = 0;
								for (let i = 0; i < ci - 1; i++) {
									pageOffset += sizeData[i];
								}
								let pLen = sizeData[ci];
								let srcList = chaptersInf[ci];
								let outputNames = [];
								for (let i = 0; i < pLen; i++) {
									let curPage = pageOffset + i;
									outputNames.push(evaluate(metaData.naming, { pad, title: metaData.title, v: args.vol, c: args.chap, p: curPage }));
								}
								*/
					
								cacheVolume(event, {
									listData,
									metaData,
									volumePaths,
									chaptersInf,
									sizeData,
									respMessage,
									vol,
									vi: args.vi,
									i: 0,
									len: sizeData.length
								}).then((retArgs) => {
									if (validExecution(event)) {
										fs.writeFileSync(volumePaths.chapterinfo, retArgs.chaptersInf.map(chap => chap.join("\n")).join("\n\n"));
										fs.writeFileSync(volumePaths.sizemeta, retArgs.sizeData.join("\n"));
										//console.log(retArgs.chaptersInf);
										pushNotify(`Caching finished on Volume ${vol}`, true);
										event.sender.send(finMessage, "");
									}
									releaseExecutor(event);
								}).catch((err) => {
									//console.log(err);
									if (validExecution(event)) {
										pushNotify("Volume caching failed:/caching terminated;", true);
										event.sender.send(finMessage, "");
									}
									releaseExecutor(event);
								})
							} catch(e) {
								console.log(e);
								pushNotify(errMessage, true);
								if (validExecution(event)) {
									fs.renameSync(paths.volumes, paths.volume + "broken");
									event.sender.send(finMessage, "");
								}
								releaseExecutor(event);
							}
						}).catch((err) => {
							pushNotify(errMessage, true);
							safeSend(event, finMessage, "");
							releaseExecutor(event);
						})
					} else {
						pushNotify(errMessage, true);
						safeSend(event, finMessage, "");	
						releaseExecutor(event);
					}
				}).catch((err) => {
					pushNotify(errMessage, true);
					safeSend(event, finMessage, "");
					releaseExecutor(event);
				});
			} else {
				pushNotify(errMessage, true);
				safeSend(event, finMessage, "");
				releaseExecutor(event);
			}
		})

		ipcMain.on("deleteSource", (event, id) => {
			const respMessage = "sourceDeleted";
			if (id.search(idRegex) == 0) {
				db.keys().all().then((keys) => {
					if (keys.includes(id)) {
						let paths = fetchIdPaths(id);
						pushNotify(`Deleting files of ${id}`);
						rm(paths.root, { recursive: true, force: true }).then(() => {
							db.del(id).then(() => {
								pushNotify(`Deleted ${id}`);
								event.sender.send(respMessage, "");
							}).catch(() => {
								pushNotify("Source deletion failed? Deleting operation restricted, how???", true);
								event.sender.send(respMessage, "");
							})
						}).catch(() => {
							pushNotify("Source deletion failed? Folder delete operation restricted;", true);
							event.sender.send(respMessage, "");
						})
					} else {
						pushNotify(`How is ${id} not a part of the database? don't hack the system >:()`);
						event.sender.send(respMessage, "");
					}
				}).catch(() => {
					pushNotify("Source deletion failed? Database halted, how did this happen...", true);
					event.sender.send(respMessage, "");
				})
				//event.sender.send(respMessage, "");
			} else {
				pushNotify("Source deletion failed? Invalid UID, how the fuck did this happen!", true);
				event.sender.send(respMessage, "");
			}
		})

		ipcMain.on("editQuery", (event, args) => {
			/*let execId = crypto.randomUUID();
			while (executors.includes(execId)) execId = crypto.randomUUID();
			event.execId = execId;
			executing = event.execId;
			executors.push(executing);*/
			const respMessage = "successQuery";
			const failMessage = "failQuery";
			if (args.id.search(idRegex) == 0) {
				db.keys().all().then((keys) => {
					if (keys.includes(args.id)) {
						let paths = fetchIdPaths(args.id);
						//pushNotify(`Editing files of ${args.id}`);
						try {
							let listData = JSON.parse(fs.readFileSync(paths.volumes));
							let metaData = JSON.parse(fs.readFileSync(paths.meta));
							let editData = args.editData.replaceAll("\r", "").trim().split("\n");

							editQuery({
								event,
								editData,
								listData,
								metaData,
								paths,
								i: 0,
								len: editData.length,
								volmode: false,
								vi: 0,
								vol: 0,
								oldvoldata: [],
								oldchapinfo: [],
								tmpchapinfo: []
							}).then((retArgs) => {
								fs.writeFileSync(paths.volumes, JSON.stringify(retArgs.listData));
								pushNotify("Finished edit query...");
								event.sender.send(respMessage, "");	
								/*
								if (validExecution(event)) {
									fs.writeFileSync(volumePaths.chapterinfo, retArgs.chaptersInf.map(chap => chap.join("\n")).join("\n\n"));
									fs.writeFileSync(volumePaths.sizemeta, retArgs.sizeData.join("\n"));
									//console.log(retArgs.chaptersInf);
									pushNotify(`Caching finished on Volume ${vol}`, true);
									event.sender.send(finMessage, "");
								}
								releaseExecutor(event);
								*/
							}).catch((err) => {
								console.log(err);
								//if (validExecution(event)) {
								pushNotify("WARNING: MODIFICATION FAILED?? (DATABASE MIGHT HAVE BEEN CORRUPTED OH LORD)", true);
								event.sender.send(failMessage, "");
								//}
								//releaseExecutor(event);
							})
						} catch(e) {
							console.log(e);
							pushNotify("Editing failed, try-catch error!", true);
							event.sender.send(failMessage, "");
							//safeSend(event, failMessage, "");
							//releaseExecutor(event);
						}	
					} else {
						pushNotify(`How is ${id} not a part of the database? don't hack the system >:()`);
						event.sender.send(failMessage, "");
						//safeSend(event, failMessage, "");
						//releaseExecutor(event);
					}
				}).catch(() => {
					pushNotify("Edit failed, database halted?", true);
					event.sender.send(failMessage, "");
					//safeSend(event, failMessage, "");
					//releaseExecutor(event);
				})
			}  else {
				pushNotify("Edit failed, invalid UID", trued);
				event.sender.send(failMessage, "");
				//safeSend(event, failMessage, "");
				//releaseExecutor(event);
			}
		})
	}

	const tokenfilters = {
		"cd": "..--",
		"vd": ".-",
		"av": ".+",
		"mc": " <- ",
		"mv": "::",
		"cformat": " - "
	};

	function editQuery(args) {
		return new Promise((resolve, reject) => {
			if (args.i >= args.len) {
				resolve(args);
				return;
			}

			function reQuery() {
				args.i++;
				editQuery(args).then((ret) => {
					resolve(ret);
				})
			}

			function disableVolMode() {
				args.volmode = false;
			}

			function getChapIdx(idx) {
				let ci;
				let vi;
				let curChap;
				let curVol;
				for (let i = 0; i < args.listData.length; i++) {
					vi = i;
					curVol = args.listData[vi][0];
					ci = args.listData[vi][1].map(chapArr => chapArr[1]).indexOf(idx);
					if (ci >= 0) {
						curChap = args.listData[vi][1][ci][1];
						break;
					}
				}
				return { ci, vi, curChap, curVol };
			}

			function arrExisting(arrayA, arrayB) {
				for (let pseudi = 0; pseudi < arrayA.length; pseudi++) {
					let arrayC = arrayA[pseudi];
					if (arrayC[0] == arrayB[0] && arrayC[1] == arrayB[1]) return true;
				}
				return false;
			}

			let token = args.editData[args.i];
			let ogToken = token;
			let execMsg = `Executed query "${ogToken}".`;
			let mcsplit = token.split(tokenfilters.mc);
			if (token.startsWith(tokenfilters.cd)) {
				disableVolMode();
				token = token.substring(tokenfilters.cd.length);
				let cMod = parseFloat(token);
				let cData = getChapIdx(cMod);
				let ci = cData.ci;
				let vi = cData.vi;
				let curVol = cData.curVol;
				if (ci >= 0) {
					let volumePaths = args.paths.volume(curVol);
					let chaptersInf = fs.readFileSync(volumePaths.chapterinfo).toString("utf8").replaceAll("\r", "").split("\n\n").map(srcList => srcList.split("\n"));
					chaptersInf.splice(ci, 1);
					fs.writeFileSync(volumePaths.chapterinfo, chaptersInf.map(chapArr => chapArr.join("\n")).join("\n\n"));
					fs.writeFileSync(volumePaths.sizemeta, chaptersInf.map(chapArr => chapArr.length).join("\n"));
					args.listData[vi][1].splice(ci, 1);
					args.event.sender.send("message", execMsg);
					reQuery();
				} else {
					args.event.sender.send("message", `Failed to delete chapter ${cMod} so skipping operation... (could be already deleted)`);
					reQuery();
				}
			} else if (token.startsWith(tokenfilters.vd)) {
				disableVolMode();
				token = token.substring(tokenfilters.vd.length);
				let vMod = parseFloat(token);
				let vi = args.listData.map(chapters => chapters[0]).indexOf(vMod);
				if (vi >= 0) {
					args.listData.splice(vi, 1);
					rm(args.paths.volume(vMod).root, { recursive: true, force: true }).then(() => {
						args.event.sender.send("message", execMsg);
						reQuery();
					}).catch(() => {
						args.event.sender.send("message", `Failed to delete volume ${vMod} so skipping operation...`);
						reQuery();
					})
				} else {
					args.event.sender.send("message", `Failed to delete volume ${vMod} so skipping operation... (could be already deleted)`);
					reQuery();
				}
			} else if (mcsplit.length == 2) {
				disableVolMode();
				let cMod = parseFloat(mcsplit[0]);
				let cPath = mcsplit[1];
				let cData = getChapIdx(cMod);
				let ci = cData.ci;
				let vi = cData.vi;
				//let curChap;
				let curVol = cData.curVol;
				/*
				for (let i = 0; i < args.listData.length; i++) {
					vi = i;
					curVol = args.listData[vi][0];
					ci = args.listData[vi][1].map(chapArr => chapArr[1]).indexOf(cMod);
					if (ci >= 0) {
						//curChap = args.listData[vi][1][ci][1];
						break;
					}
				}
				*/
				if (ci >= 0) {
					let urlPrefix = args.metaData.urlPrefix;
					scrapeSources(`${urlPrefix}${cPath}`, args.metaData.rootQuery, args.metaData.listQuery, args.metaData.imgQuery, args.metaData.srcQuery).then((sources) => {
						if (sources.length > 0) {
							args.listData[vi][1][ci][0] = cPath;
							let volumePaths = args.paths.volume(curVol);
							let chaptersInf = fs.readFileSync(volumePaths.chapterinfo).toString("utf8").replaceAll("\r", "").split("\n\n").map(srcList => srcList.split("\n"));
							chaptersInf[ci] = sources;
							fs.writeFileSync(volumePaths.chapterinfo, chaptersInf.map(chapArr => chapArr.join("\n")).join("\n\n"));
							fs.writeFileSync(volumePaths.sizemeta, chaptersInf.map(chapArr => chapArr.length).join("\n"));
							args.event.sender.send("message", execMsg);
							reQuery();
						} else {
							args.event.sender.send("message", `No sources found in chapter ${cMod}, skipping...`);
							reQuery();
						}
					}).catch((_) => {
						args.event.sender.send("message", `Failed to scrape chapter ${cMod}!<br>WARNING: Program will retry continuously!`);
						args.i--;
						reQuery();
					})
				} else {
					args.event.sender.send("message", `Chapter ${cMod} not found in the index.<br>Skipping token;`);
					reQuery();
				}
			} else if (token.startsWith(tokenfilters.av)) {
				token = token.substring(tokenfilters.av.length);
				//args.event.sender.send("message", `Add/Edit volume ${token}`);
				args.vol = parseFloat(token);
				args.vi = args.listData.map(chapters => chapters[0]).indexOf(args.vol);
				if (args.vi < 0) {
					args.vi = args.listData.length;
					args.listData[args.vi] = [args.vol, []];
				}
				args.oldvoldata = args.listData[args.vi][1];
				let cinfoPath = args.paths.volume(args.vol).chapterinfo;
				args.oldchapinfo = [];
				if (fileExists(cinfoPath)) args.oldchapinfo = fs.readFileSync(cinfoPath).toString().replaceAll("\r", "").split("\n\n").map(srcList => srcList.split("\n"));
				args.tmpchapinfo = args.oldchapinfo;
				args.volmode = true;
				args.event.sender.send("message", execMsg);
				reQuery();
			} else if (args.volmode) {
				//let voldata = args.listData[args.vi][1];
				if (token.startsWith(tokenfilters.mv)) {
					token = token.substring(tokenfilters.mv.length);
					args.listData[args.vi][1] = [];
					args.tmpchapinfo = [];
				}
				token = token.split(tokenfilters.cformat);
				if (token.length == 2) {
					let cPath = token[0];
					let cNum = parseFloat(token[1]);
					if (args.listData[args.vi][1].map(chapArr => chapArr[1]).indexOf(cNum) >= 0) {
						args.event.sender.send("message", `PROVIDED DATA IS A DUPLICATE OF CHAPTER ${cNum}, SKIPPING OPERATION`);
						reQuery();
					} else {
						let volumePaths = args.paths.volume(args.listData[args.vi][0]);
						let newCArr = [cPath, cNum];
						if (arrExisting(args.oldvoldata, newCArr)) {
							let ci = args.oldvoldata.map(chapArr => chapArr[1]).indexOf(cNum);
							args.listData[args.vi][1].push(newCArr);
							args.tmpchapinfo.push(args.oldchapinfo[ci]);
							fs.writeFileSync(volumePaths.chapterinfo, args.tmpchapinfo.map(chapArr => chapArr.join("\n")).join("\n\n"));
							fs.writeFileSync(volumePaths.sizemeta, args.tmpchapinfo.map(chapArr => chapArr.length).join("\n"));
							args.event.sender.send("message", execMsg);
							reQuery();
						} else {
							scrapeSources(`${args.metaData.urlPrefix}${cPath}`, args.metaData.rootQuery, args.metaData.listQuery, args.metaData.imgQuery, args.metaData.srcQuery).then((sources) => {
								if (sources.length > 0) {
									args.listData[args.vi][1].push(newCArr);
									args.tmpchapinfo.push(sources);
									fs.writeFileSync(volumePaths.chapterinfo, args.tmpchapinfo.map(chapArr => chapArr.join("\n")).join("\n\n"));
									fs.writeFileSync(volumePaths.sizemeta, args.tmpchapinfo.map(chapArr => chapArr.length).join("\n"));
									//console.log("modified");
									args.event.sender.send("message", execMsg);
									reQuery();
								} else {
									args.event.sender.send("message", `No sources found in chapter ${cNum}, skipping...`);
									reQuery();
								}
							}).catch((_) => {
								args.event.sender.send("message", `Failed to scrape chapter ${cNum}!<br>WARNING: Program will retry continuously!`);
								args.i--;
								reQuery();
							})
						}
					}
				} else {
					args.event.sender.send("message", `Failed to append to volume ${args.vol}.`);
					reQuery();
				}
			} else {
				args.event.sender.send("message", `Invalid token{${args.i}} entry.`);
				reQuery();
			}
		})
	}

	function cacheVolume(event, args) {
		return new Promise((resolve, reject) => {
			if (validExecution(event)) {
				event.sender.send(args.respMessage, [args.i, args.len]);
				if (args.i >= args.len) {
					//console.log("lol");
					resolve(args);
					return;
				}
				let pageOffset = 0;
				for (let i = 0; i < args.i - 1; i++) {
					pageOffset += args.sizeData[i];
				}
				let pLen = args.sizeData[args.i];
				let srcList = args.chaptersInf[args.i];
				let outputNames = [];
				for (let i = 0; i < pLen; i++) {
					let curPage = pageOffset + i;
					outputNames.push(evaluate(args.metaData.naming, { pad, title: args.metaData.title, v: args.vol, c: args.listData[args.vi][1][args.i][1], p: curPage }));
				}
				loadImages(event, {
					i: 0,
					len: pLen,
					off: pageOffset,
					src: srcList,
					names: outputNames,
					chapUrl: `${args.metaData.urlPrefix}${args.listData[args.vi][1][args.i][1]}`,
					params: [args.metaData.rootQuery, args.metaData.listQuery, args.metaData.imgQuery, args.metaData.srcQuery],
					paths: args.paths,
					volumePaths: args.volumePaths,
					respMessage: "imageProg",
					chaptersInf: args.chaptersInf
				}).then((newInf) => {
					if (validExecution(event)) {
						args.chaptersInf = newInf;
						args.sizeData = args.chaptersInf.map(chap => chap.length);
						args.i++;
						cacheVolume(event, args).then((v) => {
							resolve(v);
						}).catch((_) => {
							//console.log(erroring, "aa");
							//console.log("agn");
							reject("");
						})
					} else {
						reject("");
					}
				})
			} else {
				reject("");
			}
		})
	}

	const imgFilters = ["jpg", "png", "jpeg"];

	function loadImages(event, args) {
		return new Promise((resolve, reject) => {
			if (args.i >= args.len) {
				resolve(args.chaptersInf);
				return;
			}
			cacheImage(event, args.src[args.i], args.volumePaths, args.names[args.i], args.chapUrl, args.params, args.chaptersInf, args.i, args.len).then((cacheRes) => {
				let relPath = path.relative(cacheFolder, cacheRes.nPath);
				if (validExecution(event)) {
					event.sender.send(args.respMessage, {
						path: relPath,
						i: args.i,
						len: args.len
					})
					args.chaptersInf = cacheRes.chaptersInf;
					args.len = cacheRes.len;
					args.i++;
					loadImages(event, args).then((r) => {
						resolve(r);
					})
				} else {
					resolve(args.chaptersInf);
				}
			})
		})
	}

	function probeImage(fInitial) {
		let ext;
		for (let i = 0; i < imgFilters.length; i++) {
			let imExt = imgFilters[i];
			if (fileExists(`${fInitial}.${imExt}`)) {
				ext = imExt;
				break;
			}
		}
		return ext;
	}

	function initImageDownload(event, imgUrl, fInitial) {
		return new Promise((resolve, reject) => {
			const lib = getHttpLib(imgUrl);
			const origPath = `${fInitial}.dwn`;
			const ws = fs.createWriteStream(origPath);
			let fExt = imgFilters[0];
			let newPath = `${fInitial}.`;
			lib.get(imgUrl, (resp) => {
				resp.pipe(ws);
				ws.on("finish", () => {
					ws.close();
					if (resp.statusCode != 200) {
						//console.log("ok oh no");
						reject("recache");
						return;
					}
					validateImage(origPath).then((res) => {
						if (!res.error) if (imgFilters.includes(res.imgType.ext)) fExt = res.imgType.ext;
						newPath = `${newPath}${fExt}`;
						if (validExecution(event)) fs.renameSync(origPath, newPath);
						resolve(newPath);
					})
				})
			}).on("error", (err) => {
				ws.close();
				reject("");
			})
		})
	}

	function cacheImage(event, imgUrl, volumePaths, imgPath, chapUrl, params, chaptersInf, iter, len) {
		return new Promise((resolve, reject) => {
			function stDwn() {
				initImageDownload(event, imgUrl, fInitial).then((nPath) => {
					resolve({
						nPath,
						chaptersInf,
						len
					})
				}).catch((err) => {
					if (err == "recache") {
						//console.log("ohsh");
						scrapeSources(chapUrl, params[0], params[1], params[2], params[3]).then((sources) => {
							chaptersInf[iter] = sources;
							len = sources.length;
							cacheImage(event, imgUrl, volumePaths, imgPath, chapUrl, params, chaptersInf, iter, len).then((res) => {
								resolve(res);
							})
						}).catch((_) => {
							resolve({
								nPath: `${fInitial}.${imgFilters[0]}`,
								chaptersInf,
								len
							})
						})
					} else {
						//console.log("oh no!, restart");
						cacheImage(event, imgUrl, volumePaths, imgPath, chapUrl, params, chaptersInf, iter, len).then((res) => {
							resolve(res);
						})
					}
				})
			}

			let fPath = "";
			let fInitial = path.join(volumePaths.images, imgPath);
			let fExt = probeImage(fInitial);
			if (fExt) {
				fPath = `${fInitial}.${fExt}`;
				validateImage(fPath).then((res) => {
					if (!res.error) {
						resolve({
							nPath: fPath,
							chaptersInf,
							len
						})
						return;
					}
					stDwn();
				})
			} else {
				stDwn();
			}
		})
	}

	function validateImage(imgPath) {
		return new Promise((resolve, _reject) => {
			let imgExists = fs.existsSync(imgPath);
			if (imgExists) imgExists = fs.statSync(imgPath).isFile();
			if (imgExists) {
				readChunk(imgPath, { length: minimumBytes }).then((buf) => {
					imageType(buf).then((mimeInfo) => {
						resolve({ error: false, imgType: mimeInfo });
					}).catch((e) => {
						resolve({ error: true });
					})
				}).catch((e) => {
					resolve({ error: true });
				})
			} else {
				resolve({ error: true });
			}
		})
	}

	function init() {
		/*
		dialog.showOpenDialog({properties: ['openFile']}).then((fPath) => {
			console.log(fPath);
		})
		*/
		const eInstance = express();
		eInstance.use(express.static(relativeToAbsolute("./static")));
		eInstance.use(express.static(cacheFolder));
		const server = eInstance.listen(0, host, () => {
			const port = server.address().port;
			const mainUrl = `http://${host}:${port}`;
			const window = new BrowserWindow({
				title: "MangDownloader",
				icon: "resources/icons/md.ico",
				minWidth: 360,
				minHeight: 224,
				width: 854,
				height: 480,
				autoHideMenuBar: true,
				webPreferences: {
					devTools: false,
					nodeIntegration: false,
					contextIsolation: true,
					preload: relativeToAbsolute("./preload/preload.js")
				}
			});

			window.setMenu(null);
			window.loadURL(mainUrl);
			//window.webContents.openDevTools(); 

			let tray = null;
			window.on("close", (event) => {
				if (!tray) {
					event.preventDefault();
					window.hide();
					tray = new Tray("resources/icons/md.ico");
					const contextMenu = Menu.buildFromTemplate([
						{
							icon: "resources/icons/md-small.png",
							label: "MangDownloader",
							enabled: false
						},
						{
							type: "separator",
						},
						{
							label: "Restore", click: function () {
								window.show();
							},
						},
						{
							label: "Exit", click: function () {
								window.close();
							},
						}
					]);
					tray.setContextMenu(contextMenu);
					tray.setToolTip("MangDownloader");
					tray.on("click", () => {
						window.show();
					});
				}
			});

			let hidden = false;
			window.on("hide", (event) => {
				hidden = true;
			});

			window.on("show", (event) => {
				hidden = false;
				tray.destroy();
				tray = null;
			});

			app.on("second-instance", (event, argv, cwd) => {
				if (window) {
					if (hidden) window.show();
					if (window.isMinimized()) window.restore();
					window.focus();
				}
			})

			initIpcHandlers(); 
		});
	}

	app.whenReady().then(init);
} else {
	app.quit();
}