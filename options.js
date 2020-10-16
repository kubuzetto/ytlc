const re = /^AIza[a-zA-Z0-9\_]{35}$/;

function saveOptions(e) {
	e.preventDefault();
	var key = document.querySelector("#ytlcApiKey").value;
	var er = document.querySelector("#error");
	if (!key || !re.test(key)) {
		er.innerText = "Invalid API key \"" + key + "\".";
		er.style.display = 'block';
		key = null;
	} else er.style.display = 'none';
	
	browser.storage.local.set({ytlcApiKey: key})
		.then(() => {}, (err) => {
			if (key) {
				er.innerText = "Unable to save API key: " + err;
				er.style.display = 'block';
			}
		});
}

function restoreOptions() {
	function resp(result, error) {
		var er = document.querySelector("#error");
		if (error) {
			er.innerText = error;
			er.style.display = 'block';
		} else er.style.display = 'none';
		
		var key = result ? result.ytlcApiKey : null;
		if (!key || !re.test(key)) {
			if (!error) {
				er.innerText = "Invalid API key \"" + key + "\".";
				er.style.display = 'block';
			}
			key = null;
		}
		document.querySelector("#ytlcApiKey").value = key;
	}
	function setCurrentChoice(result) {
		resp(result, null);
	}
	function onError(error) {
		resp(null, error);
	}
	browser.storage.local.get("ytlcApiKey")
		.then(setCurrentChoice, onError);
}
function defKey(dk) {
	var i = document.querySelector("#ytlcApiKey");
	if (!i) return;
	if (!i.value || i.value.length <= 0)
		i.value = dk.innerText;
}
document.addEventListener("DOMContentLoaded", restoreOptions);
var dk = document.querySelector("#defKey");
dk.addEventListener("click", () => defKey(dk));
document.querySelector("form").addEventListener("submit", saveOptions);