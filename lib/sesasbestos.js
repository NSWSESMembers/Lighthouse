// function for searching the ops log for jobs on the SES asbestos register

var $ = require('jquery');

var searchaddress = function(addressObj,cb) {
	try {
		var opsLogId = ''
		console.log(urls.Base)
		switch (urls.Base)
		{
			case 'https://previewbeacon.ses.nsw.gov.au':
			opsLogId = '43293'
			break
			case 'https://beacon.ses.nsw.gov.au':
			opsLogId = '502900'
			break
			default:
			opsLogId = '0'
		}
		getOpsLog(opsLogId, function(result){
			if (result != false)
			{
				var OpsJSON = JSON.parse(result.responseJSON['Text'])
				if (OpsJSON.indexOf(addressObj.GnafId) != -1 || OpsJSON.indexOf(addressObj.address_pid) != -1)
				{
					cb(true)
				} else {
					cb(false)
				}
			} else {
				cb(false)
			}

		})
	} catch (e) {
		console.log("cant pass ops log result")
		cb(false);
	}

};

function getOpsLog(id,cb) {

	var localCache = {
    /**
     * timeout for cache in millis
     * @type {number}
     */
    timeout: 30000,
    /** 
     * @type {{_: number, data: {}}}
     **/
    data: {},
    remove: function (url) {
        delete localCache.data[url];
    },
    exist: function (url) {
        return !!localCache.data[url] && ((new Date().getTime() - localCache.data[url]._) < localCache.timeout);
    },
    get: function (url) {
        console.log('Getting in cache for url' + url);
        return localCache.data[url].data;
    },
    set: function (url, cachedData, callback) {
        localCache.remove(url);
        localCache.data[url] = {
            _: new Date().getTime(),
            data: cachedData
        };
        if ($.isFunction(callback)) callback(cachedData);
    }
};

$.ajaxPrefilter(function (options, originalOptions, jqXHR) {
    if (options.cache) {
        var complete = originalOptions.complete || $.noop,
            url = originalOptions.url;
        //remove jQuery cache as we have our own localCache
        options.cache = false;
        options.beforeSend = function () {
            if (localCache.exist(url)) {
                complete(localCache.get(url));
                return false;
            }
            return true;
        };
        options.complete = function (data, textStatus) {
            localCache.set(url, data, complete);
        };
    }
});

	$.ajax({
		type: 'GET'
		, url: urls.Base+'/Api/v1/OperationsLog/'+id
		, beforeSend: function(n) {
			n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
		}
		, cache: true
		, dataType: 'json'
		, complete: function(response, textStatus) {
			if(textStatus == 'success')
			{
				cb(response)
			} else {
				cb(false)
			}

		}
	})
}

module.exports = searchaddress;
