const re = /^AIza[a-zA-Z0-9\_]{35}$/;
const defaultKey = "AIzaSyDsCyeZ8B_U8hI4ZxgmHErTHtz0yK_gWaM";

var resp = function(key) {
	if (!key || !re.test(key))
		browser.storage.local.set({ytlcApiKey: defaultKey}).then(
			() => browser.runtime.openOptionsPage(),
			() => browser.runtime.openOptionsPage());
};

browser.storage.local.get("ytlcApiKey")
	.then((r) => resp(r), () => resp(null));
