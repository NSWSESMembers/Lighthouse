// function for searching the ops log for jobs on the SES asbestos register

var $ = require('jquery');

var searchaddress = function(addressObj,cb) {
	try {
		var opsLogId = ''
		switch (location.origin)
		{
			case 'https://previewbeacon.ses.nsw.gov.au':
			opsLogId = '43293'
			break
			case 'https://beacon.ses.nsw.gov.au':
			opsLogId = '502900'
			break
			case 'https://trainbeacon.ses.nsw.gov.au':
			opsLogId = '39044'
			break
			default:
			opsLogId = '0'
		}

		var SESAsbestosCache = JSON.parse(sessionStorage.getItem("lighthouseSESAsbestosCache"+opsLogId));

		if (SESAsbestosCache) {
			console.log("SES Asbestos cache valid. will check")
			if (SESAsbestosCache.indexOf(addressObj.GnafId) != -1 || SESAsbestosCache.indexOf(addressObj.address_pid) != -1)
			{
				cb(true)
			} else {
				cb(false)
			}


		} else {
			console.log("SES Asbestos cache empty. will refetch")
			getOpsLog(opsLogId, function(result){
				if (result != false)
				{
					try
					{
						console.log("saving cache:"+result.responseJSON['Text'])
						sessionStorage.setItem("lighthouseSESAsbestosCache"+opsLogId, JSON.stringify(JSON.parse(result.responseJSON['Text'])));
						var OpsJSON = JSON.parse(result.responseJSON['Text'])
						if (OpsJSON.indexOf(addressObj.GnafId) != -1 || OpsJSON.indexOf(addressObj.address_pid) != -1)
						{
							cb(true)
						} else {
							cb(false)
						}
					} catch (e)
					{
						console.log("cant pass ops log result")
						$('#asbestos-register-error').html($('#asbestos-register-error').html()+" Error searching SES asbestos register");
						cb(false);
					}
				} else {
					cb(false)
				}
			})
		}

	} catch (e) {
		console.log("cant pass ops log result")
		$('#asbestos-register-error').html($('#asbestos-register-error').html()+" Error searching SES asbestos register");
		cb(false);
	}

};

function getOpsLog(id,cb) {

	$.ajax({
		type: 'GET'
		, url: urls.Base+'/Api/v1/OperationsLog/'+id
		, beforeSend: function(n) {
			n.setRequestHeader("Authorization", "Bearer " + user.accessToken)
		}
		, cache: true
		, dataType: 'json'
		, data: {LighthouseFunction: 'LibAsbestosGetOpsLog'}
		, complete: function(response, textStatus) {
			if(textStatus == 'success')
			{
				cb(response)
			} else {
				console.log("ajax text problem")
				$('#asbestos-register-error').html($('#asbestos-register-error').html()+" Error understanding the SES asbestos register");
				cb(false)
			}

		}
		, error: function (ajaxContext) {
			console.log("ajax http problem")
			$('#asbestos-register-error').html($('#asbestos-register-error').html()+" Error searching SES asbestos register");
			cb(false)
		}
	})
}

module.exports = searchaddress;
