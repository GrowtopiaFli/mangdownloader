const failLocation = "./";

const params = new Proxy(new URLSearchParams(window.location.search), {
	get: (searchParams, prop) => searchParams.get(prop),
});

function runQueryCheck() {
	if (typeof(params.id) === "string") {
		if (params.id.search(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) === 0) return true;
	}
	return false;
}