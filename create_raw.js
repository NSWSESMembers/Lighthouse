function MessageManager() {
    function n(n, t, i, r, u, f, e) {
        $.ajax(urls.Api.messages, {
            type: "POST",
            data: {
                Operational: t,
                MessageText: n,
                Recipients: i,
                ContactGroupIds: r
            }
        }).done(function(n) {
            u && u(n)
        }).fail(function(n) {
            f && f(n)
        }).always(function(n) {
            e && e(n)
        })
    }
    function t(n, t, i, r) {
        $.ajax(urls.Api.messages + "/" + n, {
            type: "GET"
        }).done(function(n) {
            t && t(n)
        }).fail(function(n) {
            i && i(n)
        }).always(function(n) {
            r && r(n)
        })
    }
    function i(n, t, i, r) {
        $.ajax(urls.Api.messages + "/Search", {
            type: "GET",
            data: n,
            cache: !1
        }).done(function(n) {
            t && t(n)
        }).fail(function(n) {
            i && i(n)
        }).always(function(n) {
            r && r(n)
        })
    }
    function r(n, t, i, r) {
        $.ajax(urls.Api.messages + "/" + n + "/Resolve", {
            type: "PUT"
        }).done(function(n) {
            t && t(n)
        }).fail(function(n) {
            i && i(n)
        }).always(function(n) {
            r && r(n)
        })
    }
    function u(n, t) {
        if (!Enum || !Enum.ContactTypeEnum || !t)
            return !1;
        var r = !1
          , i = null ;
        switch (t) {
        case Enum.ContactTypeEnum.Email.Id:
            i = /\S+@\S+\.\S+/,
            r = i.test(n);
            break;
        case Enum.ContactTypeEnum.Page.Id:
            i = /^\d+$/,
            r = i.test(n);
            break;
        case Enum.ContactTypeEnum.SMS.Id:
        case Enum.ContactTypeEnum.Mobile.Id:
            i = /^[0-9 ]{10,14}$/,
            r = i.test(n);
            break;
        case Enum.ContactTypeEnum.Phone.Id:
            i = /^[0-9 ]{6,20}$/,
            r = i.test(n)
        }
        return r
    }
    function f(n) {
        return !Enum || !Enum.RoleEnum || !n ? !1 : user.isInRole(Enum.RoleEnum.MessageManagement.Id, n)
    }
    return {
        SendMessage: n,
        GetMessage: t,
        SearchForMessages: i,
        ResolveMessage: r,
        ValidContactDetail: u,
        CanManageMessage: f
    }
}
function EntityManager() {
    function r(t, i, r, u) {
        $.ajax(n + "/" + t, {
            dataType: "json",
            type: "GET"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
    function u(t, i, r, u) {
        return $.ajax(n + "/" + t, {
            dataType: "json",
            type: "GET"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
    function t(t, i, r, u, f, e, o) {
        var s = {
            PageIndex: t,
            PageSize: i,
            SortField: r,
            SortOrder: u
        };
        return $.ajax(n, {
            data: s,
            dataType: "json",
            type: "GET"
        }).done(function(n) {
            f && f(n)
        }).fail(function(n) {
            e && e(n)
        }).always(function(n) {
            o && o(n)
        }),
        !0
    }
    function f(t, i, r, u, f) {
        $.ajax(n + "/" + t + "/People", {
            dataType: "json",
            data: {
                pagedViewModel: i
            },
            type: "GET"
        }).done(function(n) {
            r && r(n)
        }).fail(function(n) {
            u && u(n)
        }).always(function(n) {
            f && f(n)
        })
    }
    function e(n, r, u, f, e) {
        var s = 1
          , o = 40;
        t(s, o, n, r, function(h) {
            var c;
            u && u(h);
            var v = Math.ceil(h.TotalItems / o)
              , l = []
              , a = s;
            for (c = 0; c < v; c++)
                l.push(function(i) {
                    a++,
                    t(a, o, n, r, function(n) {
                        u && u(n),
                        i(null , n)
                    }, function(n) {
                        f && f(n),
                        i("Error Occured", n)
                    }, function() {})
                });
            async.parallelLimit(l, i, function(n, t) {
                e && e(t)
            })
        }, function() {
            f && f()
        }, function() {})
    }
    function o(t, i, r, u) {
        return $.ajax(n + "/" + t + "/Children", {
            dataType: "json",
            type: "GET"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
    function s(t, i, r) {
        return $.ajax(n + "/EntityTree", {
            dataType: "json",
            type: "GET"
        }).done(function(n) {
            t && t(n)
        }).fail(function(n) {
            i && i(n)
        }).always(function(n) {
            r && r(n)
        })
    }
    function h(t, i, r, u) {
        return $.ajax(n + "/" + t + "/Contacts", {
            dataType: "json",
            type: "GET"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
    var i = 5
      , n = urls.Api.entities;
    return {
        GetEntityByCode: r,
        GetEntityById: u,
        GetAll: e,
        GetPagedEntities: t,
        GetEntityChildrenById: o,
        GetEntityTree: s,
        GetPagedPeople: f,
        GetContacts: h
    }
}
function ContactGroupManager() {
    function t(t, i, r, u) {
        $.ajax(n + "/Search", {
            data: t,
            type: "GET",
            dataType: "json",
            cache: !1
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
    function i(t, i, r, u) {
        return t < 0 ? !1 : ($.ajax(n + "/" + t, {
            dataType: "json",
            type: "GET"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        }),
        !0)
    }
    function r(t, i, r, u, f, e, o, s) {
        if (t < 0)
            return !1;
        var h = {
            PageIndex: i,
            PageSize: r,
            SortField: u,
            SortOrder: f
        };
        return i < 0 && (h.PageIndex = 0),
        r <= 0 && (h.PageSize = 5),
        u || (h.SortField = "createdon"),
        f || (h.SortOrder = "desc"),
        $.ajax(n + "/headquarters/" + t, {
            data: h,
            dataType: "json",
            type: "GET"
        }).done(function(n) {
            e && e(n)
        }).fail(function(n) {
            o && o(n)
        }).always(function(n) {
            s && s(n)
        }),
        !0
    }
    function u(t, i, r, u, f, e, o, s) {
        if (t < 0)
            return !1;
        var h = {
            PageIndex: i,
            PageSize: r,
            SortField: u,
            SortOrder: f
        };
        return $.ajax(n + "/headquarters/" + t + "/contacts", {
            data: h,
            dataType: "json",
            type: "GET"
        }).done(function(n) {
            e && e(n)
        }).fail(function(n) {
            o && o(n)
        }).always(function(n) {
            s && s(n)
        }),
        !0
    }
    function f(t, i, r, u, f, e, o, s, h) {
        $.ajax(n + "/ForJob", {
            data: {
                JobCriteria: {
                    PriorityId: t.priorityId,
                    EntityAssignedToId: t.entityAssignedTo.Id || 0,
                    JobTypeId: t.jobTypeId
                },
                Escalation: i,
                PageIndex: r,
                PageSize: u,
                SortField: f,
                SortOrder: e
            },
            type: "GET"
        }).done(function(n) {
            o && o(n)
        }).fail(function(n) {
            s && s(n)
        }).always(function(n) {
            h && h(n)
        })
    }
    function e(t, i, r, u, f) {
        if (i < 0 || t < 0)
            return !1;
        $.ajax(n + "/" + t + "/contact", {
            dataType: "json",
            type: "POST",
            data: {
                Ids: [i]
            }
        }).done(function(n) {
            r(n)
        }).fail(function(n) {
            u(n)
        }).always(function(n) {
            f && f(n)
        })
    }
    function o(t, i, r, u, f) {
        if (i < 0 || t < 0)
            return !1;
        $.ajax(n + "/" + t + "/contact", {
            dataType: "json",
            type: "DELETE",
            data: {
                Ids: [i]
            }
        }).done(function(n) {
            r && r(n)
        }).fail(function(n) {
            u && u(n)
        }).always(function(n) {
            f && f(n)
        })
    }
    function s(t, i, r, u) {
        if (t < 0)
            return !1;
        $.ajax(n + "/" + t, {
            dataType: "json",
            type: "DELETE"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
    function h(t, i, r, u) {
        return $.ajax(n, {
            data: t,
            dataType: "json",
            type: "POST"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        }),
        !0
    }
    function c(t, i, r, u) {
        return $.ajax(n + "/" + t.Id, {
            data: t,
            dataType: "json",
            type: "PUT"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        }),
        !0
    }
    function l(t, i, r, u) {
        $.ajax(n + "/BulkDelete", {
            data: {
                Ids: t
            },
            dataType: "json",
            type: "POST"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
    function a(n) {
        return !Enum || !Enum.RoleEnum || !n ? !1 : user.isInRole(Enum.RoleEnum.ContactGroupsManagement.Id, n)
    }
    var n = urls.Api.contactGroups;
    return {
        GetContactGroupsForHeadquarters: r,
        GetContactGroupsForJob: f,
        GetContactGroupsForHeadquartersWithContacts: u,
        DeleteContactGroup: s,
        AddContactToGroup: e,
        RemoveContactFromGroup: o,
        CreateContactGroup: h,
        UpdateContactGroup: c,
        GetContactGroup: i,
        Search: t,
        BulkDelete: l,
        CanManageContactGroup: a
    }
}
function ContactManager() {
    function n(n, t, i, r, u, f, e, o) {
        if (!n)
            return !1;
        var s = {
            PageIndex: t,
            PageSize: i,
            SortOrder: r,
            SortField: u
        };
        return $.ajax(urls.Api.contacts + "/headquarters/" + n + "/people", {
            data: s,
            dataType: "json",
            type: "GET"
        }).done(function(n) {
            f && f(n)
        }).fail(function(n) {
            e && e(n)
        }).always(function(n) {
            o && o(n)
        }),
        !0
    }
    function t(n, t, i, r) {
        $.ajax(urls.Api.contacts + "/" + n.Id, {
            data: n,
            dataType: "json",
            type: "PUT"
        }).done(function(n) {
            t && t(n)
        }).fail(function(n) {
            i && i(n)
        }).always(function(n) {
            r && r(n)
        })
    }
    function i(n, t, i, r, u) {
        if (n) {
            var f = t ? t : !1;
            $.ajax(urls.Api.contacts + "/Job/" + n + "?escalation=" + f, {
                type: "GET"
            }).done(function(n) {
                i && i(n)
            }).fail(function(n) {
                r && r(n)
            }).always(function(n) {
                u && u(n)
            })
        }
    }
    function r(n, t, i, r, u) {
        $.ajax(urls.Api.contacts + "/" + n + "/ContactGroups", {
            type: "GET",
            data: t
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
    function u(n, t, i, r) {
        $.ajax(urls.Api.contacts, {
            data: n,
            dataType: "json",
            type: "POST"
        }).done(function(n) {
            t && t(n)
        }).fail(function(n) {
            i && i(n)
        }).always(function(n) {
            r && r(n)
        })
    }
    return {
        GetPeoplesContactDetailsForHeadquarters: n,
        GetContactsForJob: i,
        GetContactGroupsForContact: r,
        UpdateContact: t,
        CreateContact: u
    }
}
function CreateMessageViewModel() {
    function i() {
        _.each(n.selectedRecipients(), function(t) {
            var r = _.find(n.availableContacts(), function(n) {
                return t.Contact != null  && t.Contact.Id == n.Id
            }), i;
            r && n.availableContacts.remove(r),
            i = _.find(n.availableContactGroups(), function(n) {
                return t.ContactGroup != null  && t.ContactGroup.Id == n.Id
            }),
            i && n.availableContactGroups.remove(i)
        })
    }
    var n = this
      , f = new ContactGroupManager
      , r = new MessageManager
      , e = new PersonManager
      , o = new EntityManager;
    n.selectedHeadquarters = ko.observable(),
    n.selectedPerson = ko.observable(),
    n.selectedContactGroupName = ko.observable(),
    n.availableContacts = ko.observableArray([]),
    n.availableContactGroups = ko.observableArray([]),
    n.selectedRecipients = ko.observableArray([]).extend({
        validation: {
            validator: function(n) {
                return n != null  && n.length > 0
            },
            message: "You must select at least 1 recipient"
        }
    }),
    n.messageText = ko.observable().extend({
        required: !0
    }),
    n.sendingMessage = ko.observable(!1),
    n.loadingContactGroups = ko.observable(!1),
    n.loadingContacts = ko.observable(!1),
    n.operational = ko.observable(null ).extend({
        required: !0
    }),
    n.enableCustomRecipient = ko.observable(!1),
    n.showCustomRecipient = function() {
        n.enableCustomRecipient(!n.enableCustomRecipient())
    }
    ,
    n.availableContactTypes = ko.observableArray(),
    n.availableContactTypes(_.values(Enum.ContactTypeEnum)),
    n.contactTypeId = ko.observable(null ),
    n.contactDetail = ko.observable(null ).extend({
        validation: {
            validator: function(t) {
                return r.ValidContactDetail(t, n.contactTypeId())
            },
            message: "Invalid Detail for Contact Type"
        }
    }),
    n.contactDescription = ko.observable("").extend({
        required: !0
    }),
    n.addCustomContact = function() {
        if (n.customRecipientErrors().length > 0) {
            n.customRecipientErrors.showAllMessages();
            return
        }
        var t = _.find(n.selectedRecipients(), function(t) {
            return t.Recipient === n.contactDetail()
        });
        t || n.pushSelectedRecipient(n.contactTypeId(), n.contactDescription(), n.contactDetail()),
        n.clearCustomRecipient()
    }
    ,
    n.pushSelectedRecipient = function(t, i, r) {
        n.selectedRecipients.push({
            Contact: null ,
            ContactGroup: null ,
            ContactTypeId: t,
            Description: i,
            Recipient: r
        })
    }
    ,
    n.clearCustomRecipient = function() {
        n.contactTypeId(null ),
        n.contactDescription(null ),
        n.contactDescription.isModified(!1),
        n.contactDetail(null ),
        n.contactDetail.isModified(!1)
    }
    ,
    n.closeAlertMessage = function() {
        n.alertMessage(null )
    }
    ,
    n.alertMessage = ko.observable(),
    n.selectedContactName = ko.computed(function() {
        return n.selectedHeadquarters() ? n.selectedHeadquarters().Name : n.selectedPerson() ? n.selectedPerson().FirstName + " " + n.selectedPerson().LastName : ""
    }, n),
    n.selectedContactCount = ko.computed(function() {
        return n.selectedHeadquarters() ? n.availableContactGroups().length + n.availableContacts().length : n.selectedPerson() ? n.availableContacts().length : ""
    }, n),
    n.setSelectedHeadquarters = function(i) {
        u = 1,
        t = 0,
        n.availableContactGroups([]),
        n.availableContacts([]),
        n.selectedHeadquarters(i),
        i && (n.loadContactsForHeadquarters(),
        n.loadContactGroupsForHeadquarters())
    }
    ,
    n.setSelectedPerson = function(t) {
        n.availableContacts([]),
        n.selectedPerson(t),
        t && n.loadContactsForPerson(t.Id)
    }
    ;
    var u = 1
      , s = 30
      , t = 0;
    n.loadContactsForHeadquarters = function() {
        n.selectedHeadquarters() && o.GetContacts(n.selectedHeadquarters().Id, function(t) {
            _.each(t.Results, function(t) {
                n.availableContacts.push(t)
            }),
            i()
        }, function() {}, function() {})
    }
    ,
    n.loadContactGroupsForHeadquarters = function() {
        n.selectedHeadquarters() && (n.availableContactGroups().length > 0 && t <= n.availableContactGroups().length || (n.loadingContacts(!0),
        f.GetContactGroupsForHeadquarters(n.selectedHeadquarters().Id, u++, s, "name", "asc", function(r) {
            t = r.TotalItems,
            _.each(r.Results, function(t) {
                n.availableContactGroups.push(t)
            }),
            i()
        }, function() {
            n.setAlertMessage("Error loading Contact Groups for Headquarters", utility.alertTypes.error)
        }, function() {
            n.loadingContacts(!1)
        })))
    }
    ,
    n.loadContactsForPerson = function(r) {
        n.loadingContacts(!0),
        e.GetContactsForPerson(r, function(r) {
            t = r.TotalItems,
            _.each(r.Results, function(t) {
                n.availableContacts.push(t)
            }),
            i()
        }, function() {
            n.setAlertMessage("Error loading contacts for Person", utility.alertTypes.error)
        }, function() {
            n.loadingContacts(!1)
        })
    }
    ,
    n.addContact = function(t) {
        n.selectedRecipients.push({
            Contact: t,
            ContactGroup: null ,
            ContactTypeId: t.ContactTypeId,
            Description: t.PersonId ? t.FirstName + " " + t.LastName : t.EntityName,
            Recipient: t.Detail
        }),
        n.availableContacts.remove(t)
    }
    ,
    n.addContactGroup = function(t) {
        n.selectedRecipients.push({
            Contact: null ,
            ContactGroup: t,
            ContactTypeId: null ,
            Description: t.Entity.Name,
            Recipient: t.Name
        }),
        n.availableContactGroups.remove(t)
    }
    ,
    n.removeRecipient = function(t) {
        n.selectedRecipients.remove(t),
        t.ContactGroup != null  && n.selectedHeadquarters() != null  && t.ContactGroup.Entity.Id == n.selectedHeadquarters().Id ? n.availableContactGroups.push(t.ContactGroup) : (t.Contact != null  && n.selectedPerson() != null  && t.Contact.PersonId == n.selectedPerson().Id || n.selectedPerson() != null  && t.Contact.EntityId == n.selectedHeadquarters().Id) && n.availableContacts.push(t.Contact)
    }
    ,
    n.clear = function() {
        n.messageText(null ),
        n.messageText.isModified(!1),
        n.selectedRecipients([]),
        n.selectedRecipients.isModified(!1),
        n.availableContacts([]),
        n.availableContactGroups([]),
        n.selectedHeadquarters(null ),
        n.selectedPerson(null ),
        n.selectedContactGroupName(null ),
        n.operational(null ),
        n.operational.isModified(!1)
    }
    ,
    n.sendMessage = function() {
        if (n.errors().length > 0) {
            n.errors.showAllMessages();
            return
        }
        var t = []
          , i = [];
        n.sendingMessage(!0),
        _.each(n.selectedRecipients(), function(n) {
            n.ContactGroup ? t.push(n.ContactGroup.Id) : i.push({
                Recipient: n.Recipient,
                Description: n.Description,
                ContactId: n.Contact ? n.Contact.Id : null ,
                ContactTypeId: n.ContactTypeId
            })
        }),
        r.SendMessage(n.messageText(), n.operational(), i, t, function(t) {
            n.setAlertMessage("Successfully Send Message", utility.alertTypes.success, t.Id, "View Message Progress"),
            n.clear(),
            t.Recipients != null  && t.Recipients.length > 0 && _.any(t.Recipients, function(n) {
                return n.MessageRecipientTypeId == Enum.MessageRecipientTypeEnum.HardCall.Id
            }) && (window.location.href = "/Messages/" + t.Id)
        }, function() {
            n.setAlertMessage("Error Sending Message", utility.alertTypes.error)
        }, function() {
            n.sendingMessage(!1)
        })
    }
    ,
    n.setAlertMessage = function(t, i, r, u) {
        var f = null ;
        r && u && (f = {
            Id: r,
            Name: u
        }),
        n.alertMessage({
            Message: t,
            Type: i,
            Resource: f
        })
    }
}
var Handlebars = function() {
    var u = function() {
        "use strict";
        function n(n) {
            this.string = n
        }
        var t;
        return n.prototype.toString = function() {
            return "" + this.string
        }
        ,
        t = n
    }()
      , t = function(n) {
        "use strict";
        function f(n) {
            return c[n] || "&amp;"
        }
        function e(n, t) {
            for (var i in t)
                t.hasOwnProperty(i) && (n[i] = t[i])
        }
        function o(n) {
            return n instanceof h ? n.toString() : n || 0 === n ? (n = "" + n,
            a.test(n) ? n.replace(l, f) : n) : ""
        }
        function s(n) {
            return n || 0 === n ? u(n) && 0 === n.length ? !0 : !1 : !0
        }
        var t = {}, h = n, c = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#x27;",
            "`": "&#x60;"
        }, l = /[&<>"'`]/g, a = /[&<>"'`]/, i, r, u;
        return t.extend = e,
        i = Object.prototype.toString,
        t.toString = i,
        r = function(n) {
            return "function" == typeof n
        }
        ,
        r(/x/) && (r = function(n) {
            return "function" == typeof n && "[object Function]" === i.call(n)
        }
        ),
        t.isFunction = r,
        u = Array.isArray || function(n) {
            return n && "object" == typeof n ? "[object Array]" === i.call(n) : !1
        }
        ,
        t.isArray = u,
        t.escapeExpression = o,
        t.isEmpty = s,
        t
    }(u)
      , n = function() {
        "use strict";
        function t() {
            for (var i = Error.prototype.constructor.apply(this, arguments), t = 0; t < n.length; t++)
                this[n[t]] = i[n[t]]
        }
        var i, n = ["description", "fileName", "lineNumber", "message", "name", "number", "stack"];
        return t.prototype = new Error,
        i = t
    }()
      , i = function(n, t) {
        "use strict";
        function e(n, t) {
            this.helpers = n || {},
            this.partials = t || {},
            y(this)
        }
        function y(n) {
            n.registerHelper("helperMissing", function(n) {
                if (2 === arguments.length)
                    return void 0;
                throw new Error("Missing helper: '" + n + "'");
            }),
            n.registerHelper("blockHelperMissing", function(t, i) {
                var r = i.inverse || function() {}
                  , u = i.fn;
                return f(t) && (t = t.call(this)),
                t === !0 ? u(this) : t === !1 || null  == t ? r(this) : l(t) ? t.length > 0 ? n.helpers.each(t, i) : r(this) : u(t)
            }),
            n.registerHelper("each", function(n, t) {
                var i, s = t.fn, c = t.inverse, r = 0, u = "", h, e;
                if (f(n) && (n = n.call(this)),
                t.data && (i = o(t.data)),
                n && "object" == typeof n)
                    if (l(n))
                        for (h = n.length; h > r; r++)
                            i && (i.index = r,
                            i.first = 0 === r,
                            i.last = r === n.length - 1),
                            u += s(n[r], {
                                data: i
                            });
                    else
                        for (e in n)
                            n.hasOwnProperty(e) && (i && (i.key = e),
                            u += s(n[e], {
                                data: i
                            }),
                            r++);
                return 0 === r && (u = c(this)),
                u
            }),
            n.registerHelper("if", function(n, t) {
                return f(n) && (n = n.call(this)),
                !t.hash.includeZero && !n || r.isEmpty(n) ? t.inverse(this) : t.fn(this)
            }),
            n.registerHelper("unless", function(t, i) {
                return n.helpers["if"].call(this, t, {
                    fn: i.inverse,
                    inverse: i.fn,
                    hash: i.hash
                })
            }),
            n.registerHelper("with", function(n, t) {
                return f(n) && (n = n.call(this)),
                r.isEmpty(n) ? void 0 : t.fn(n)
            }),
            n.registerHelper("log", function(t, i) {
                var r = i.data && null  != i.data.level ? parseInt(i.data.level, 10) : 1;
                n.log(r, t)
            })
        }
        function s(n, t) {
            u.log(n, t)
        }
        var i = {}, r = n, p = t, w = "1.1.2", h, c, u, o;
        i.VERSION = w,
        h = 4,
        i.COMPILER_REVISION = h,
        c = {
            1: "<= 1.0.rc.2",
            2: "== 1.0.0-rc.3",
            3: "== 1.0.0-rc.4",
            4: ">= 1.0.0"
        },
        i.REVISION_CHANGES = c;
        var l = r.isArray
          , f = r.isFunction
          , a = r.toString
          , v = "[object Object]";
        return i.HandlebarsEnvironment = e,
        e.prototype = {
            constructor: e,
            logger: u,
            log: s,
            registerHelper: function(n, t, i) {
                if (a.call(n) === v) {
                    if (i || t)
                        throw new p("Arg not supported with multiple helpers");
                    r.extend(this.helpers, n)
                } else
                    i && (t.not = i),
                    this.helpers[n] = t
            },
            registerPartial: function(n, t) {
                a.call(n) === v ? r.extend(this.partials, n) : this.partials[n] = t
            }
        },
        u = {
            methodMap: {
                0: "debug",
                1: "info",
                2: "warn",
                3: "error"
            },
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3,
            level: 3,
            log: function(n, t) {
                if (u.level <= n) {
                    var i = u.methodMap[n];
                    "undefined" != typeof console && console[i] && console[i].call(console, t)
                }
            }
        },
        i.logger = u,
        i.log = s,
        o = function(n) {
            var t = {};
            return r.extend(t, n),
            t
        }
        ,
        i.createFrame = o,
        i
    }(t, n)
      , o = function(n, t, i) {
        "use strict";
        function l(n) {
            var t = n && n[0] || 1, i = v, r, u;
            if (t !== i) {
                if (i > t) {
                    r = c[i],
                    u = c[t];
                    throw new Error("Template was precompiled with an older version of Handlebars than the current runtime. Please update your precompiler to a newer version (" + r + ") or downgrade your runtime to an older version (" + u + ").");
                }
                throw new Error("Template was precompiled with a newer version of Handlebars than the current runtime. Please update your runtime to a newer version (" + n[1] + ").");
            }
        }
        function a(n, t) {
            var r, i;
            if (!t)
                throw new Error("No environment passed to template");
            return r = t.compile ? function(n, i, r, u, e, o) {
                var s = f.apply(this, arguments), h;
                return s ? s : (h = {
                    helpers: u,
                    partials: e,
                    data: o
                },
                e[i] = t.compile(n, {
                    data: void 0 !== o
                }, t),
                e[i](r, h))
            }
             : function(n, t) {
                var i = f.apply(this, arguments);
                if (i)
                    return i;
                throw new h("The partial " + t + " could not be compiled when running in runtime-only mode");
            }
            ,
            i = {
                escapeExpression: e.escapeExpression,
                invokePartial: r,
                programs: [],
                program: function(n, t, i) {
                    var r = this.programs[n];
                    return i ? r = u(n, t, i) : r || (r = this.programs[n] = u(n, t)),
                    r
                },
                merge: function(n, t) {
                    var i = n || t;
                    return n && t && n !== t && (i = {},
                    e.extend(i, t),
                    e.extend(i, n)),
                    i
                },
                programWithDepth: o,
                noop: s,
                compilerInfo: null 
            },
            function(r, u) {
                var f, e, o, s;
                return u = u || {},
                o = u.partial ? u : t,
                u.partial || (f = u.helpers,
                e = u.partials),
                s = n.call(i, o, r, f, e, u.data),
                u.partial || l(i.compilerInfo),
                s
            }
        }
        function o(n, t, i) {
            var u = Array.prototype.slice.call(arguments, 3)
              , r = function(n, r) {
                return r = r || {},
                t.apply(this, [n, r.data || i].concat(u))
            }
            ;
            return r.program = n,
            r.depth = u.length,
            r
        }
        function u(n, t, i) {
            var r = function(n, r) {
                return r = r || {},
                t(n, r.data || i)
            }
            ;
            return r.program = n,
            r.depth = 0,
            r
        }
        function f(n, t, i, r, u, f) {
            var e = {
                partial: !0,
                helpers: r,
                partials: u,
                data: f
            };
            if (void 0 === n)
                throw new h("The partial " + t + " could not be found");
            if (n instanceof Function)
                return n(i, e)
        }
        function s() {
            return ""
        }
        var r = {}
          , e = n
          , h = t
          , v = i.COMPILER_REVISION
          , c = i.REVISION_CHANGES;
        return r.template = a,
        r.programWithDepth = o,
        r.program = u,
        r.invokePartial = f,
        r.noop = s,
        r
    }(t, n, i)
      , s = function(n, t, i, r, u) {
        "use strict";
        var c, f = n, l = t, a = i, e = r, o = u, s = function() {
            var n = new f.HandlebarsEnvironment;
            return e.extend(n, f),
            n.SafeString = l,
            n.Exception = a,
            n.Utils = e,
            n.VM = o,
            n.template = function(t) {
                return o.template(t, n)
            }
            ,
            n
        }
        , h = s();
        return h.create = s,
        c = h
    }(i, u, n, t, o)
      , r = function(n) {
        "use strict";
        function i(n, t, r) {
            this.type = "program",
            this.statements = n,
            this.strip = {},
            r ? (this.inverse = new i(r,t),
            this.strip.right = t.left) : t && (this.strip.left = t.right)
        }
        function u(n, t, i, r) {
            var u;
            this.type = "mustache",
            this.hash = t,
            this.strip = r,
            u = i[3] || i[2],
            this.escaped = "{" !== u && "&" !== u;
            var f = this.id = n[0]
              , e = this.params = n.slice(1)
              , o = this.eligibleHelper = f.isSimple;
            this.isHelper = o && (e.length || t)
        }
        function f(n, t, i) {
            this.type = "partial",
            this.partialName = n,
            this.context = t,
            this.strip = i
        }
        function e(n, t, i, u) {
            if (n.id.original !== u.path.original)
                throw new r(n.id.original + " doesn't match " + u.path.original);
            this.type = "block",
            this.mustache = n,
            this.program = t,
            this.inverse = i,
            this.strip = {
                left: n.strip.left,
                right: u.strip.right
            },
            (t || i).strip.left = n.strip.right,
            (i || t).strip.right = u.strip.left,
            i && !t && (this.isInverse = !0)
        }
        function o(n) {
            this.type = "content",
            this.string = n
        }
        function s(n) {
            this.type = "hash",
            this.pairs = n
        }
        function h(n) {
            var t;
            this.type = "ID";
            for (var f = "", i = [], e = 0, u = 0, o = n.length; o > u; u++)
                if (t = n[u].part,
                f += (n[u].separator || "") + t,
                ".." === t || "." === t || "this" === t) {
                    if (i.length > 0)
                        throw new r("Invalid path: " + f);
                    ".." === t ? e++ : this.isScoped = !0
                } else
                    i.push(t);
            this.original = f,
            this.parts = i,
            this.string = i.join("."),
            this.depth = e,
            this.isSimple = 1 === n.length && !this.isScoped && 0 === e,
            this.stringModeValue = this.string
        }
        function c(n) {
            this.type = "PARTIAL_NAME",
            this.name = n.original
        }
        function l(n) {
            this.type = "DATA",
            this.id = n
        }
        function a(n) {
            this.type = "STRING",
            this.original = this.string = this.stringModeValue = n
        }
        function v(n) {
            this.type = "INTEGER",
            this.original = this.integer = n,
            this.stringModeValue = Number(n)
        }
        function y(n) {
            this.type = "BOOLEAN",
            this.bool = n,
            this.stringModeValue = "true" === n
        }
        function p(n) {
            this.type = "comment",
            this.comment = n
        }
        var t = {}
          , r = n;
        return t.ProgramNode = i,
        t.MustacheNode = u,
        t.PartialNode = f,
        t.BlockNode = e,
        t.ContentNode = o,
        t.HashNode = s,
        t.IdNode = h,
        t.PartialNameNode = c,
        t.DataNode = l,
        t.StringNode = a,
        t.IntegerNode = v,
        t.BooleanNode = y,
        t.CommentNode = p,
        t
    }(n)
      , h = function() {
        "use strict";
        var n, t = function() {
            function n(n, t) {
                return {
                    left: "~" === n[2],
                    right: "~" === t[0] || "~" === t[1]
                }
            }
            function t() {
                this.yy = {}
            }
            var i = {
                trace: function() {},
                yy: {},
                symbols_: {
                    error: 2,
                    root: 3,
                    statements: 4,
                    EOF: 5,
                    program: 6,
                    simpleInverse: 7,
                    statement: 8,
                    openInverse: 9,
                    closeBlock: 10,
                    openBlock: 11,
                    mustache: 12,
                    partial: 13,
                    CONTENT: 14,
                    COMMENT: 15,
                    OPEN_BLOCK: 16,
                    inMustache: 17,
                    CLOSE: 18,
                    OPEN_INVERSE: 19,
                    OPEN_ENDBLOCK: 20,
                    path: 21,
                    OPEN: 22,
                    OPEN_UNESCAPED: 23,
                    CLOSE_UNESCAPED: 24,
                    OPEN_PARTIAL: 25,
                    partialName: 26,
                    partial_option0: 27,
                    inMustache_repetition0: 28,
                    inMustache_option0: 29,
                    dataName: 30,
                    param: 31,
                    STRING: 32,
                    INTEGER: 33,
                    BOOLEAN: 34,
                    hash: 35,
                    hash_repetition_plus0: 36,
                    hashSegment: 37,
                    ID: 38,
                    EQUALS: 39,
                    DATA: 40,
                    pathSegments: 41,
                    SEP: 42,
                    $accept: 0,
                    $end: 1
                },
                terminals_: {
                    2: "error",
                    5: "EOF",
                    14: "CONTENT",
                    15: "COMMENT",
                    16: "OPEN_BLOCK",
                    18: "CLOSE",
                    19: "OPEN_INVERSE",
                    20: "OPEN_ENDBLOCK",
                    22: "OPEN",
                    23: "OPEN_UNESCAPED",
                    24: "CLOSE_UNESCAPED",
                    25: "OPEN_PARTIAL",
                    32: "STRING",
                    33: "INTEGER",
                    34: "BOOLEAN",
                    38: "ID",
                    39: "EQUALS",
                    40: "DATA",
                    42: "SEP"
                },
                productions_: [0, [3, 2], [3, 1], [6, 2], [6, 3], [6, 2], [6, 1], [6, 1], [6, 0], [4, 1], [4, 2], [8, 3], [8, 3], [8, 1], [8, 1], [8, 1], [8, 1], [11, 3], [9, 3], [10, 3], [12, 3], [12, 3], [13, 4], [7, 2], [17, 3], [17, 1], [31, 1], [31, 1], [31, 1], [31, 1], [31, 1], [35, 1], [37, 3], [26, 1], [26, 1], [26, 1], [30, 2], [21, 1], [41, 3], [41, 1], [27, 0], [27, 1], [28, 0], [28, 2], [29, 0], [29, 1], [36, 1], [36, 2]],
                performAction: function(t, i, r, u, f, e) {
                    var o = e.length - 1;
                    switch (f) {
                    case 1:
                        return new u.ProgramNode(e[o - 1]);
                    case 2:
                        return new u.ProgramNode([]);
                    case 3:
                        this.$ = new u.ProgramNode([],e[o - 1],e[o]);
                        break;
                    case 4:
                        this.$ = new u.ProgramNode(e[o - 2],e[o - 1],e[o]);
                        break;
                    case 5:
                        this.$ = new u.ProgramNode(e[o - 1],e[o],[]);
                        break;
                    case 6:
                        this.$ = new u.ProgramNode(e[o]);
                        break;
                    case 7:
                        this.$ = new u.ProgramNode([]);
                        break;
                    case 8:
                        this.$ = new u.ProgramNode([]);
                        break;
                    case 9:
                        this.$ = [e[o]];
                        break;
                    case 10:
                        e[o - 1].push(e[o]),
                        this.$ = e[o - 1];
                        break;
                    case 11:
                        this.$ = new u.BlockNode(e[o - 2],e[o - 1].inverse,e[o - 1],e[o]);
                        break;
                    case 12:
                        this.$ = new u.BlockNode(e[o - 2],e[o - 1],e[o - 1].inverse,e[o]);
                        break;
                    case 13:
                        this.$ = e[o];
                        break;
                    case 14:
                        this.$ = e[o];
                        break;
                    case 15:
                        this.$ = new u.ContentNode(e[o]);
                        break;
                    case 16:
                        this.$ = new u.CommentNode(e[o]);
                        break;
                    case 17:
                        this.$ = new u.MustacheNode(e[o - 1][0],e[o - 1][1],e[o - 2],n(e[o - 2], e[o]));
                        break;
                    case 18:
                        this.$ = new u.MustacheNode(e[o - 1][0],e[o - 1][1],e[o - 2],n(e[o - 2], e[o]));
                        break;
                    case 19:
                        this.$ = {
                            path: e[o - 1],
                            strip: n(e[o - 2], e[o])
                        };
                        break;
                    case 20:
                        this.$ = new u.MustacheNode(e[o - 1][0],e[o - 1][1],e[o - 2],n(e[o - 2], e[o]));
                        break;
                    case 21:
                        this.$ = new u.MustacheNode(e[o - 1][0],e[o - 1][1],e[o - 2],n(e[o - 2], e[o]));
                        break;
                    case 22:
                        this.$ = new u.PartialNode(e[o - 2],e[o - 1],n(e[o - 3], e[o]));
                        break;
                    case 23:
                        this.$ = n(e[o - 1], e[o]);
                        break;
                    case 24:
                        this.$ = [[e[o - 2]].concat(e[o - 1]), e[o]];
                        break;
                    case 25:
                        this.$ = [[e[o]], null ];
                        break;
                    case 26:
                        this.$ = e[o];
                        break;
                    case 27:
                        this.$ = new u.StringNode(e[o]);
                        break;
                    case 28:
                        this.$ = new u.IntegerNode(e[o]);
                        break;
                    case 29:
                        this.$ = new u.BooleanNode(e[o]);
                        break;
                    case 30:
                        this.$ = e[o];
                        break;
                    case 31:
                        this.$ = new u.HashNode(e[o]);
                        break;
                    case 32:
                        this.$ = [e[o - 2], e[o]];
                        break;
                    case 33:
                        this.$ = new u.PartialNameNode(e[o]);
                        break;
                    case 34:
                        this.$ = new u.PartialNameNode(new u.StringNode(e[o]));
                        break;
                    case 35:
                        this.$ = new u.PartialNameNode(new u.IntegerNode(e[o]));
                        break;
                    case 36:
                        this.$ = new u.DataNode(e[o]);
                        break;
                    case 37:
                        this.$ = new u.IdNode(e[o]);
                        break;
                    case 38:
                        e[o - 2].push({
                            part: e[o],
                            separator: e[o - 1]
                        }),
                        this.$ = e[o - 2];
                        break;
                    case 39:
                        this.$ = [{
                            part: e[o]
                        }];
                        break;
                    case 42:
                        this.$ = [];
                        break;
                    case 43:
                        e[o - 1].push(e[o]);
                        break;
                    case 46:
                        this.$ = [e[o]];
                        break;
                    case 47:
                        e[o - 1].push(e[o])
                    }
                },
                table: [{
                    3: 1,
                    4: 2,
                    5: [1, 3],
                    8: 4,
                    9: 5,
                    11: 6,
                    12: 7,
                    13: 8,
                    14: [1, 9],
                    15: [1, 10],
                    16: [1, 12],
                    19: [1, 11],
                    22: [1, 13],
                    23: [1, 14],
                    25: [1, 15]
                }, {
                    1: [3]
                }, {
                    5: [1, 16],
                    8: 17,
                    9: 5,
                    11: 6,
                    12: 7,
                    13: 8,
                    14: [1, 9],
                    15: [1, 10],
                    16: [1, 12],
                    19: [1, 11],
                    22: [1, 13],
                    23: [1, 14],
                    25: [1, 15]
                }, {
                    1: [2, 2]
                }, {
                    5: [2, 9],
                    14: [2, 9],
                    15: [2, 9],
                    16: [2, 9],
                    19: [2, 9],
                    20: [2, 9],
                    22: [2, 9],
                    23: [2, 9],
                    25: [2, 9]
                }, {
                    4: 20,
                    6: 18,
                    7: 19,
                    8: 4,
                    9: 5,
                    11: 6,
                    12: 7,
                    13: 8,
                    14: [1, 9],
                    15: [1, 10],
                    16: [1, 12],
                    19: [1, 21],
                    20: [2, 8],
                    22: [1, 13],
                    23: [1, 14],
                    25: [1, 15]
                }, {
                    4: 20,
                    6: 22,
                    7: 19,
                    8: 4,
                    9: 5,
                    11: 6,
                    12: 7,
                    13: 8,
                    14: [1, 9],
                    15: [1, 10],
                    16: [1, 12],
                    19: [1, 21],
                    20: [2, 8],
                    22: [1, 13],
                    23: [1, 14],
                    25: [1, 15]
                }, {
                    5: [2, 13],
                    14: [2, 13],
                    15: [2, 13],
                    16: [2, 13],
                    19: [2, 13],
                    20: [2, 13],
                    22: [2, 13],
                    23: [2, 13],
                    25: [2, 13]
                }, {
                    5: [2, 14],
                    14: [2, 14],
                    15: [2, 14],
                    16: [2, 14],
                    19: [2, 14],
                    20: [2, 14],
                    22: [2, 14],
                    23: [2, 14],
                    25: [2, 14]
                }, {
                    5: [2, 15],
                    14: [2, 15],
                    15: [2, 15],
                    16: [2, 15],
                    19: [2, 15],
                    20: [2, 15],
                    22: [2, 15],
                    23: [2, 15],
                    25: [2, 15]
                }, {
                    5: [2, 16],
                    14: [2, 16],
                    15: [2, 16],
                    16: [2, 16],
                    19: [2, 16],
                    20: [2, 16],
                    22: [2, 16],
                    23: [2, 16],
                    25: [2, 16]
                }, {
                    17: 23,
                    21: 24,
                    30: 25,
                    38: [1, 28],
                    40: [1, 27],
                    41: 26
                }, {
                    17: 29,
                    21: 24,
                    30: 25,
                    38: [1, 28],
                    40: [1, 27],
                    41: 26
                }, {
                    17: 30,
                    21: 24,
                    30: 25,
                    38: [1, 28],
                    40: [1, 27],
                    41: 26
                }, {
                    17: 31,
                    21: 24,
                    30: 25,
                    38: [1, 28],
                    40: [1, 27],
                    41: 26
                }, {
                    21: 33,
                    26: 32,
                    32: [1, 34],
                    33: [1, 35],
                    38: [1, 28],
                    41: 26
                }, {
                    1: [2, 1]
                }, {
                    5: [2, 10],
                    14: [2, 10],
                    15: [2, 10],
                    16: [2, 10],
                    19: [2, 10],
                    20: [2, 10],
                    22: [2, 10],
                    23: [2, 10],
                    25: [2, 10]
                }, {
                    10: 36,
                    20: [1, 37]
                }, {
                    4: 38,
                    8: 4,
                    9: 5,
                    11: 6,
                    12: 7,
                    13: 8,
                    14: [1, 9],
                    15: [1, 10],
                    16: [1, 12],
                    19: [1, 11],
                    20: [2, 7],
                    22: [1, 13],
                    23: [1, 14],
                    25: [1, 15]
                }, {
                    7: 39,
                    8: 17,
                    9: 5,
                    11: 6,
                    12: 7,
                    13: 8,
                    14: [1, 9],
                    15: [1, 10],
                    16: [1, 12],
                    19: [1, 21],
                    20: [2, 6],
                    22: [1, 13],
                    23: [1, 14],
                    25: [1, 15]
                }, {
                    17: 23,
                    18: [1, 40],
                    21: 24,
                    30: 25,
                    38: [1, 28],
                    40: [1, 27],
                    41: 26
                }, {
                    10: 41,
                    20: [1, 37]
                }, {
                    18: [1, 42]
                }, {
                    18: [2, 42],
                    24: [2, 42],
                    28: 43,
                    32: [2, 42],
                    33: [2, 42],
                    34: [2, 42],
                    38: [2, 42],
                    40: [2, 42]
                }, {
                    18: [2, 25],
                    24: [2, 25]
                }, {
                    18: [2, 37],
                    24: [2, 37],
                    32: [2, 37],
                    33: [2, 37],
                    34: [2, 37],
                    38: [2, 37],
                    40: [2, 37],
                    42: [1, 44]
                }, {
                    21: 45,
                    38: [1, 28],
                    41: 26
                }, {
                    18: [2, 39],
                    24: [2, 39],
                    32: [2, 39],
                    33: [2, 39],
                    34: [2, 39],
                    38: [2, 39],
                    40: [2, 39],
                    42: [2, 39]
                }, {
                    18: [1, 46]
                }, {
                    18: [1, 47]
                }, {
                    24: [1, 48]
                }, {
                    18: [2, 40],
                    21: 50,
                    27: 49,
                    38: [1, 28],
                    41: 26
                }, {
                    18: [2, 33],
                    38: [2, 33]
                }, {
                    18: [2, 34],
                    38: [2, 34]
                }, {
                    18: [2, 35],
                    38: [2, 35]
                }, {
                    5: [2, 11],
                    14: [2, 11],
                    15: [2, 11],
                    16: [2, 11],
                    19: [2, 11],
                    20: [2, 11],
                    22: [2, 11],
                    23: [2, 11],
                    25: [2, 11]
                }, {
                    21: 51,
                    38: [1, 28],
                    41: 26
                }, {
                    8: 17,
                    9: 5,
                    11: 6,
                    12: 7,
                    13: 8,
                    14: [1, 9],
                    15: [1, 10],
                    16: [1, 12],
                    19: [1, 11],
                    20: [2, 3],
                    22: [1, 13],
                    23: [1, 14],
                    25: [1, 15]
                }, {
                    4: 52,
                    8: 4,
                    9: 5,
                    11: 6,
                    12: 7,
                    13: 8,
                    14: [1, 9],
                    15: [1, 10],
                    16: [1, 12],
                    19: [1, 11],
                    20: [2, 5],
                    22: [1, 13],
                    23: [1, 14],
                    25: [1, 15]
                }, {
                    14: [2, 23],
                    15: [2, 23],
                    16: [2, 23],
                    19: [2, 23],
                    20: [2, 23],
                    22: [2, 23],
                    23: [2, 23],
                    25: [2, 23]
                }, {
                    5: [2, 12],
                    14: [2, 12],
                    15: [2, 12],
                    16: [2, 12],
                    19: [2, 12],
                    20: [2, 12],
                    22: [2, 12],
                    23: [2, 12],
                    25: [2, 12]
                }, {
                    14: [2, 18],
                    15: [2, 18],
                    16: [2, 18],
                    19: [2, 18],
                    20: [2, 18],
                    22: [2, 18],
                    23: [2, 18],
                    25: [2, 18]
                }, {
                    18: [2, 44],
                    21: 56,
                    24: [2, 44],
                    29: 53,
                    30: 60,
                    31: 54,
                    32: [1, 57],
                    33: [1, 58],
                    34: [1, 59],
                    35: 55,
                    36: 61,
                    37: 62,
                    38: [1, 63],
                    40: [1, 27],
                    41: 26
                }, {
                    38: [1, 64]
                }, {
                    18: [2, 36],
                    24: [2, 36],
                    32: [2, 36],
                    33: [2, 36],
                    34: [2, 36],
                    38: [2, 36],
                    40: [2, 36]
                }, {
                    14: [2, 17],
                    15: [2, 17],
                    16: [2, 17],
                    19: [2, 17],
                    20: [2, 17],
                    22: [2, 17],
                    23: [2, 17],
                    25: [2, 17]
                }, {
                    5: [2, 20],
                    14: [2, 20],
                    15: [2, 20],
                    16: [2, 20],
                    19: [2, 20],
                    20: [2, 20],
                    22: [2, 20],
                    23: [2, 20],
                    25: [2, 20]
                }, {
                    5: [2, 21],
                    14: [2, 21],
                    15: [2, 21],
                    16: [2, 21],
                    19: [2, 21],
                    20: [2, 21],
                    22: [2, 21],
                    23: [2, 21],
                    25: [2, 21]
                }, {
                    18: [1, 65]
                }, {
                    18: [2, 41]
                }, {
                    18: [1, 66]
                }, {
                    8: 17,
                    9: 5,
                    11: 6,
                    12: 7,
                    13: 8,
                    14: [1, 9],
                    15: [1, 10],
                    16: [1, 12],
                    19: [1, 11],
                    20: [2, 4],
                    22: [1, 13],
                    23: [1, 14],
                    25: [1, 15]
                }, {
                    18: [2, 24],
                    24: [2, 24]
                }, {
                    18: [2, 43],
                    24: [2, 43],
                    32: [2, 43],
                    33: [2, 43],
                    34: [2, 43],
                    38: [2, 43],
                    40: [2, 43]
                }, {
                    18: [2, 45],
                    24: [2, 45]
                }, {
                    18: [2, 26],
                    24: [2, 26],
                    32: [2, 26],
                    33: [2, 26],
                    34: [2, 26],
                    38: [2, 26],
                    40: [2, 26]
                }, {
                    18: [2, 27],
                    24: [2, 27],
                    32: [2, 27],
                    33: [2, 27],
                    34: [2, 27],
                    38: [2, 27],
                    40: [2, 27]
                }, {
                    18: [2, 28],
                    24: [2, 28],
                    32: [2, 28],
                    33: [2, 28],
                    34: [2, 28],
                    38: [2, 28],
                    40: [2, 28]
                }, {
                    18: [2, 29],
                    24: [2, 29],
                    32: [2, 29],
                    33: [2, 29],
                    34: [2, 29],
                    38: [2, 29],
                    40: [2, 29]
                }, {
                    18: [2, 30],
                    24: [2, 30],
                    32: [2, 30],
                    33: [2, 30],
                    34: [2, 30],
                    38: [2, 30],
                    40: [2, 30]
                }, {
                    18: [2, 31],
                    24: [2, 31],
                    37: 67,
                    38: [1, 68]
                }, {
                    18: [2, 46],
                    24: [2, 46],
                    38: [2, 46]
                }, {
                    18: [2, 39],
                    24: [2, 39],
                    32: [2, 39],
                    33: [2, 39],
                    34: [2, 39],
                    38: [2, 39],
                    39: [1, 69],
                    40: [2, 39],
                    42: [2, 39]
                }, {
                    18: [2, 38],
                    24: [2, 38],
                    32: [2, 38],
                    33: [2, 38],
                    34: [2, 38],
                    38: [2, 38],
                    40: [2, 38],
                    42: [2, 38]
                }, {
                    5: [2, 22],
                    14: [2, 22],
                    15: [2, 22],
                    16: [2, 22],
                    19: [2, 22],
                    20: [2, 22],
                    22: [2, 22],
                    23: [2, 22],
                    25: [2, 22]
                }, {
                    5: [2, 19],
                    14: [2, 19],
                    15: [2, 19],
                    16: [2, 19],
                    19: [2, 19],
                    20: [2, 19],
                    22: [2, 19],
                    23: [2, 19],
                    25: [2, 19]
                }, {
                    18: [2, 47],
                    24: [2, 47],
                    38: [2, 47]
                }, {
                    39: [1, 69]
                }, {
                    21: 56,
                    30: 60,
                    31: 70,
                    32: [1, 57],
                    33: [1, 58],
                    34: [1, 59],
                    38: [1, 28],
                    40: [1, 27],
                    41: 26
                }, {
                    18: [2, 32],
                    24: [2, 32],
                    38: [2, 32]
                }],
                defaultActions: {
                    3: [2, 2],
                    16: [2, 1],
                    50: [2, 41]
                },
                parseError: function(n) {
                    throw new Error(n);
                },
                parse: function(n) {
                    function it() {
                        var n;
                        return n = k.lexer.lex() || 1,
                        "number" != typeof n && (n = k.symbols_[n] || n),
                        n
                    }
                    var k = this, r = [0], e = [null ], t = [], h = this.table, d = "", c = 0, g = 0, y = 0, l, nt, i, p, o, u, w, a, f, tt, v, s, b;
                    for (this.lexer.setInput(n),
                    this.lexer.yy = this.yy,
                    this.yy.lexer = this.lexer,
                    this.yy.parser = this,
                    "undefined" == typeof this.lexer.yylloc && (this.lexer.yylloc = {}),
                    l = this.lexer.yylloc,
                    t.push(l),
                    nt = this.lexer.options && this.lexer.options.ranges,
                    "function" == typeof this.yy.parseError && (this.parseError = this.yy.parseError),
                    s = {}; ; ) {
                        if ((o = r[r.length - 1],
                        this.defaultActions[o] ? u = this.defaultActions[o] : ((null  === i || "undefined" == typeof i) && (i = it()),
                        u = h[o] && h[o][i]),
                        "undefined" == typeof u || !u.length || !u[0]) && (b = "",
                        !y)) {
                            v = [];
                            for (a in h[o])
                                this.terminals_[a] && a > 2 && v.push("'" + this.terminals_[a] + "'");
                            b = this.lexer.showPosition ? "Parse error on line " + (c + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + v.join(", ") + ", got '" + (this.terminals_[i] || i) + "'" : "Parse error on line " + (c + 1) + ": Unexpected " + (1 == i ? "end of input" : "'" + (this.terminals_[i] || i) + "'"),
                            this.parseError(b, {
                                text: this.lexer.match,
                                token: this.terminals_[i] || i,
                                line: this.lexer.yylineno,
                                loc: l,
                                expected: v
                            })
                        }
                        if (u[0] instanceof Array && u.length > 1)
                            throw new Error("Parse Error: multiple actions possible at state: " + o + ", token: " + i);
                        switch (u[0]) {
                        case 1:
                            r.push(i),
                            e.push(this.lexer.yytext),
                            t.push(this.lexer.yylloc),
                            r.push(u[1]),
                            i = null ,
                            p ? (i = p,
                            p = null ) : (g = this.lexer.yyleng,
                            d = this.lexer.yytext,
                            c = this.lexer.yylineno,
                            l = this.lexer.yylloc,
                            y > 0 && y--);
                            break;
                        case 2:
                            if (f = this.productions_[u[1]][1],
                            s.$ = e[e.length - f],
                            s._$ = {
                                first_line: t[t.length - (f || 1)].first_line,
                                last_line: t[t.length - 1].last_line,
                                first_column: t[t.length - (f || 1)].first_column,
                                last_column: t[t.length - 1].last_column
                            },
                            nt && (s._$.range = [t[t.length - (f || 1)].range[0], t[t.length - 1].range[1]]),
                            w = this.performAction.call(s, d, g, c, this.yy, u[1], e, t),
                            "undefined" != typeof w)
                                return w;
                            f && (r = r.slice(0, -2 * f),
                            e = e.slice(0, -1 * f),
                            t = t.slice(0, -1 * f)),
                            r.push(this.productions_[u[1]][0]),
                            e.push(s.$),
                            t.push(s._$),
                            tt = h[r[r.length - 2]][r[r.length - 1]],
                            r.push(tt);
                            break;
                        case 3:
                            return !0
                        }
                    }
                    return !0
                }
            }
              , r = function() {
                var n = {
                    EOF: 1,
                    parseError: function(n, t) {
                        if (!this.yy.parser)
                            throw new Error(n);
                        this.yy.parser.parseError(n, t)
                    },
                    setInput: function(n) {
                        return this._input = n,
                        this._more = this._less = this.done = !1,
                        this.yylineno = this.yyleng = 0,
                        this.yytext = this.matched = this.match = "",
                        this.conditionStack = ["INITIAL"],
                        this.yylloc = {
                            first_line: 1,
                            first_column: 0,
                            last_line: 1,
                            last_column: 0
                        },
                        this.options.ranges && (this.yylloc.range = [0, 0]),
                        this.offset = 0,
                        this
                    },
                    input: function() {
                        var n = this._input[0], t;
                        return this.yytext += n,
                        this.yyleng++,
                        this.offset++,
                        this.match += n,
                        this.matched += n,
                        t = n.match(/(?:\r\n?|\n).*/g),
                        t ? (this.yylineno++,
                        this.yylloc.last_line++) : this.yylloc.last_column++,
                        this.options.ranges && this.yylloc.range[1]++,
                        this._input = this._input.slice(1),
                        n
                    },
                    unput: function(n) {
                        var i = n.length, t = n.split(/(?:\r\n?|\n)/g), r, u;
                        return this._input = n + this._input,
                        this.yytext = this.yytext.substr(0, this.yytext.length - i - 1),
                        this.offset -= i,
                        r = this.match.split(/(?:\r\n?|\n)/g),
                        this.match = this.match.substr(0, this.match.length - 1),
                        this.matched = this.matched.substr(0, this.matched.length - 1),
                        t.length - 1 && (this.yylineno -= t.length - 1),
                        u = this.yylloc.range,
                        this.yylloc = {
                            first_line: this.yylloc.first_line,
                            last_line: this.yylineno + 1,
                            first_column: this.yylloc.first_column,
                            last_column: t ? (t.length === r.length ? this.yylloc.first_column : 0) + r[r.length - t.length].length - t[0].length : this.yylloc.first_column - i
                        },
                        this.options.ranges && (this.yylloc.range = [u[0], u[0] + this.yyleng - i]),
                        this
                    },
                    more: function() {
                        return this._more = !0,
                        this
                    },
                    less: function(n) {
                        this.unput(this.match.slice(n))
                    },
                    pastInput: function() {
                        var n = this.matched.substr(0, this.matched.length - this.match.length);
                        return (n.length > 20 ? "..." : "") + n.substr(-20).replace(/\n/g, "")
                    },
                    upcomingInput: function() {
                        var n = this.match;
                        return n.length < 20 && (n += this._input.substr(0, 20 - n.length)),
                        (n.substr(0, 20) + (n.length > 20 ? "..." : "")).replace(/\n/g, "")
                    },
                    showPosition: function() {
                        var n = this.pastInput()
                          , t = new Array(n.length + 1).join("-");
                        return n + this.upcomingInput() + "\n" + t + "^"
                    },
                    next: function() {
                        var f, n, r, e, t, u, i;
                        if (this.done)
                            return this.EOF;
                        for (this._input || (this.done = !0),
                        this._more || (this.yytext = "",
                        this.match = ""),
                        u = this._currentRules(),
                        i = 0; i < u.length && (r = this._input.match(this.rules[u[i]]),
                        !r || n && !(r[0].length > n[0].length) || (n = r,
                        e = i,
                        this.options.flex)); i++)
                            ;
                        return n ? (t = n[0].match(/(?:\r\n?|\n).*/g),
                        t && (this.yylineno += t.length),
                        this.yylloc = {
                            first_line: this.yylloc.last_line,
                            last_line: this.yylineno + 1,
                            first_column: this.yylloc.last_column,
                            last_column: t ? t[t.length - 1].length - t[t.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + n[0].length
                        },
                        this.yytext += n[0],
                        this.match += n[0],
                        this.matches = n,
                        this.yyleng = this.yytext.length,
                        this.options.ranges && (this.yylloc.range = [this.offset, this.offset += this.yyleng]),
                        this._more = !1,
                        this._input = this._input.slice(n[0].length),
                        this.matched += n[0],
                        f = this.performAction.call(this, this.yy, this, u[e], this.conditionStack[this.conditionStack.length - 1]),
                        this.done && this._input && (this.done = !1),
                        f ? f : void 0) : "" === this._input ? this.EOF : this.parseError("Lexical error on line " + (this.yylineno + 1) + ". Unrecognized text.\n" + this.showPosition(), {
                            text: "",
                            token: null ,
                            line: this.yylineno
                        })
                    },
                    lex: function() {
                        var n = this.next();
                        return "undefined" != typeof n ? n : this.lex()
                    },
                    begin: function(n) {
                        this.conditionStack.push(n)
                    },
                    popState: function() {
                        return this.conditionStack.pop()
                    },
                    _currentRules: function() {
                        return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules
                    },
                    topState: function() {
                        return this.conditionStack[this.conditionStack.length - 2]
                    },
                    pushState: function(n) {
                        this.begin(n)
                    }
                };
                return n.options = {},
                n.performAction = function(n, t, i) {
                    function u(n, i) {
                        return t.yytext = t.yytext.substr(n, t.yyleng - i)
                    }
                    switch (i) {
                    case 0:
                        if ("\\\\" === t.yytext.slice(-2) ? (u(0, 1),
                        this.begin("mu")) : "\\" === t.yytext.slice(-1) ? (u(0, 1),
                        this.begin("emu")) : this.begin("mu"),
                        t.yytext)
                            return 14;
                        break;
                    case 1:
                        return 14;
                    case 2:
                        return "\\" !== t.yytext.slice(-1) && this.popState(),
                        "\\" === t.yytext.slice(-1) && u(0, 1),
                        14;
                    case 3:
                        return u(0, 4),
                        this.popState(),
                        15;
                    case 4:
                        return 25;
                    case 5:
                        return 16;
                    case 6:
                        return 20;
                    case 7:
                        return 19;
                    case 8:
                        return 19;
                    case 9:
                        return 23;
                    case 10:
                        return 22;
                    case 11:
                        this.popState(),
                        this.begin("com");
                        break;
                    case 12:
                        return u(3, 5),
                        this.popState(),
                        15;
                    case 13:
                        return 22;
                    case 14:
                        return 39;
                    case 15:
                        return 38;
                    case 16:
                        return 38;
                    case 17:
                        return 42;
                    case 19:
                        return this.popState(),
                        24;
                    case 20:
                        return this.popState(),
                        18;
                    case 21:
                        return t.yytext = u(1, 2).replace(/\\"/g, '"'),
                        32;
                    case 22:
                        return t.yytext = u(1, 2).replace(/\\'/g, "'"),
                        32;
                    case 23:
                        return 40;
                    case 24:
                        return 34;
                    case 25:
                        return 34;
                    case 26:
                        return 33;
                    case 27:
                        return 38;
                    case 28:
                        return t.yytext = u(1, 2),
                        38;
                    case 29:
                        return "INVALID";
                    case 30:
                        return 5
                    }
                }
                ,
                n.rules = [/^(?:[^\x00]*?(?=(\{\{)))/, /^(?:[^\x00]+)/, /^(?:[^\x00]{2,}?(?=(\{\{|$)))/, /^(?:[\s\S]*?--\}\})/, /^(?:\{\{(~)?>)/, /^(?:\{\{(~)?#)/, /^(?:\{\{(~)?\/)/, /^(?:\{\{(~)?\^)/, /^(?:\{\{(~)?\s*else\b)/, /^(?:\{\{(~)?\{)/, /^(?:\{\{(~)?&)/, /^(?:\{\{!--)/, /^(?:\{\{![\s\S]*?\}\})/, /^(?:\{\{(~)?)/, /^(?:=)/, /^(?:\.\.)/, /^(?:\.(?=([=~}\s\/.])))/, /^(?:[\/.])/, /^(?:\s+)/, /^(?:\}(~)?\}\})/, /^(?:(~)?\}\})/, /^(?:"(\\["]|[^"])*")/, /^(?:'(\\[']|[^'])*')/, /^(?:@)/, /^(?:true(?=([~}\s])))/, /^(?:false(?=([~}\s])))/, /^(?:-?[0-9]+(?=([~}\s])))/, /^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.]))))/, /^(?:\[[^\]]*\])/, /^(?:.)/, /^(?:$)/],
                n.conditions = {
                    mu: {
                        rules: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
                        inclusive: !1
                    },
                    emu: {
                        rules: [2],
                        inclusive: !1
                    },
                    com: {
                        rules: [3],
                        inclusive: !1
                    },
                    INITIAL: {
                        rules: [0, 1, 30],
                        inclusive: !0
                    }
                },
                n
            }();
            return i.lexer = r,
            t.prototype = i,
            i.Parser = t,
            new t
        }();
        return n = t
    }()
      , f = function(n, t) {
        "use strict";
        function f(n) {
            return n.constructor === u.ProgramNode ? n : (r.yy = u,
            r.parse(n))
        }
        var i = {}
          , r = n
          , u = t;
        return i.parser = r,
        i.parse = f,
        i
    }(h, r)
      , e = function(n) {
        "use strict";
        function i(n) {
            this.value = n
        }
        function t() {}
        var e, o = n.COMPILER_REVISION, s = n.REVISION_CHANGES, u = n.log;
        t.prototype = {
            nameLookup: function(n, i) {
                var u, r;
                return 0 === n.indexOf("depth") && (u = !0),
                r = /^[0-9]+$/.test(i) ? n + "[" + i + "]" : t.isValidJavaScriptVariableName(i) ? n + "." + i : n + "['" + i + "']",
                u ? "(" + n + " && " + r + ")" : r
            },
            appendToBuffer: function(n) {
                return this.environment.isSimple ? "return " + n + ";" : {
                    appendToBuffer: !0,
                    content: n,
                    toString: function() {
                        return "buffer += " + n + ";"
                    }
                }
            },
            initializeBuffer: function() {
                return this.quotedString("")
            },
            namespace: "Handlebars",
            compile: function(n, t, i, r) {
                var f, e, o;
                for (this.environment = n,
                this.options = t || {},
                u("debug", this.environment.disassemble() + "\n\n"),
                this.name = this.environment.name,
                this.isChild = !!i,
                this.context = i || {
                    programs: [],
                    environments: [],
                    aliases: {}
                },
                this.preamble(),
                this.stackSlot = 0,
                this.stackVars = [],
                this.registers = {
                    list: []
                },
                this.compileStack = [],
                this.inlineStack = [],
                this.compileChildren(n, t),
                e = n.opcodes,
                this.i = 0,
                o = e.length; this.i < o; this.i++)
                    f = e[this.i],
                    "DECLARE" === f.opcode ? this[f.name] = f.value : this[f.opcode].apply(this, f.args),
                    f.opcode !== this.stripNext && (this.stripNext = !1);
                return this.pushSource(""),
                this.createFunctionContext(r)
            },
            preamble: function() {
                var n = [], i, t;
                this.isChild ? n.push("") : (i = this.namespace,
                t = "helpers = this.merge(helpers, " + i + ".helpers);",
                this.environment.usePartial && (t = t + " partials = this.merge(partials, " + i + ".partials);"),
                this.options.data && (t += " data = data || {};"),
                n.push(t)),
                this.environment.isSimple ? n.push("") : n.push(", buffer = " + this.initializeBuffer()),
                this.lastContext = 0,
                this.source = n
            },
            createFunctionContext: function(n) {
                var c = this.stackVars.concat(this.registers.list), i, t, e, l, h;
                if (c.length > 0 && (this.source[1] = this.source[1] + ", " + c.join(", ")),
                !this.isChild)
                    for (i in this.context.aliases)
                        this.context.aliases.hasOwnProperty(i) && (this.source[1] = this.source[1] + ", " + i + "=" + this.context.aliases[i]);
                this.source[1] && (this.source[1] = "var " + this.source[1].substring(2) + ";"),
                this.isChild || (this.source[1] += "\n" + this.context.programs.join("\n") + "\n"),
                this.environment.isSimple || this.pushSource("return buffer;");
                for (var r = this.isChild ? ["depth0", "data"] : ["Handlebars", "depth0", "helpers", "partials", "data"], f = 0, a = this.environment.depths.list.length; a > f; f++)
                    r.push("depth" + this.environment.depths.list[f]);
                return (t = this.mergeSource(),
                this.isChild || (e = o,
                l = s[e],
                t = "this.compilerInfo = [" + e + ",'" + l + "'];\n" + t),
                n) ? (r.push(t),
                Function.apply(this, r)) : (h = "function " + (this.name || "") + "(" + r.join(",") + ") {\n  " + t + "}",
                u("debug", h + "\n\n"),
                h)
            },
            mergeSource: function() {
                for (var t, n, i = "", r = 0, u = this.source.length; u > r; r++)
                    t = this.source[r],
                    t.appendToBuffer ? n = n ? n + "\n    + " + t.content : t.content : (n && (i += "buffer += " + n + ";\n  ",
                    n = void 0),
                    i += t + "\n  ");
                return i
            },
            blockValue: function() {
                this.context.aliases.blockHelperMissing = "helpers.blockHelperMissing";
                var n = ["depth0"];
                this.setupParams(0, n),
                this.replaceStack(function(t) {
                    return n.splice(1, 0, t),
                    "blockHelperMissing.call(" + n.join(", ") + ")"
                })
            },
            ambiguousBlockValue: function() {
                var n, t;
                this.context.aliases.blockHelperMissing = "helpers.blockHelperMissing",
                n = ["depth0"],
                this.setupParams(0, n),
                t = this.topStack(),
                n.splice(1, 0, t),
                n[n.length - 1] = "options",
                this.pushSource("if (!" + this.lastHelper + ") { " + t + " = blockHelperMissing.call(" + n.join(", ") + "); }")
            },
            appendContent: function(n) {
                this.pendingContent && (n = this.pendingContent + n),
                this.stripNext && (n = n.replace(/^\s+/, "")),
                this.pendingContent = n
            },
            strip: function() {
                this.pendingContent && (this.pendingContent = this.pendingContent.replace(/\s+$/, "")),
                this.stripNext = "strip"
            },
            append: function() {
                this.flushInline();
                var n = this.popStack();
                this.pushSource("if(" + n + " || " + n + " === 0) { " + this.appendToBuffer(n) + " }"),
                this.environment.isSimple && this.pushSource("else { " + this.appendToBuffer("''") + " }")
            },
            appendEscaped: function() {
                this.context.aliases.escapeExpression = "this.escapeExpression",
                this.pushSource(this.appendToBuffer("escapeExpression(" + this.popStack() + ")"))
            },
            getContext: function(n) {
                this.lastContext !== n && (this.lastContext = n)
            },
            lookupOnContext: function(n) {
                this.push(this.nameLookup("depth" + this.lastContext, n, "context"))
            },
            pushContext: function() {
                this.pushStackLiteral("depth" + this.lastContext)
            },
            resolvePossibleLambda: function() {
                this.context.aliases.functionType = '"function"',
                this.replaceStack(function(n) {
                    return "typeof " + n + " === functionType ? " + n + ".apply(depth0) : " + n
                })
            },
            lookup: function(n) {
                this.replaceStack(function(t) {
                    return t + " == null || " + t + " === false ? " + t + " : " + this.nameLookup(t, n, "context")
                })
            },
            lookupData: function() {
                this.push("data")
            },
            pushStringParam: function(n, t) {
                this.pushStackLiteral("depth" + this.lastContext),
                this.pushString(t),
                "string" == typeof n ? this.pushString(n) : this.pushStackLiteral(n)
            },
            emptyHash: function() {
                this.pushStackLiteral("{}"),
                this.options.stringParams && (this.register("hashTypes", "{}"),
                this.register("hashContexts", "{}"))
            },
            pushHash: function() {
                this.hash = {
                    values: [],
                    types: [],
                    contexts: []
                }
            },
            popHash: function() {
                var n = this.hash;
                this.hash = void 0,
                this.options.stringParams && (this.register("hashContexts", "{" + n.contexts.join(",") + "}"),
                this.register("hashTypes", "{" + n.types.join(",") + "}")),
                this.push("{\n    " + n.values.join(",\n    ") + "\n  }")
            },
            pushString: function(n) {
                this.pushStackLiteral(this.quotedString(n))
            },
            push: function(n) {
                return this.inlineStack.push(n),
                n
            },
            pushLiteral: function(n) {
                this.pushStackLiteral(n)
            },
            pushProgram: function(n) {
                null  != n ? this.pushStackLiteral(this.programExpression(n)) : this.pushStackLiteral(null )
            },
            invokeHelper: function(n, t) {
                this.context.aliases.helperMissing = "helpers.helperMissing";
                var i = this.lastHelper = this.setupHelper(n, t, !0)
                  , r = this.nameLookup("depth" + this.lastContext, t, "context");
                this.push(i.name + " || " + r),
                this.replaceStack(function(n) {
                    return n + " ? " + n + ".call(" + i.callParams + ") : helperMissing.call(" + i.helperMissingParams + ")"
                })
            },
            invokeKnownHelper: function(n, t) {
                var i = this.setupHelper(n, t);
                this.push(i.name + ".call(" + i.callParams + ")")
            },
            invokeAmbiguous: function(n, t) {
                this.context.aliases.functionType = '"function"',
                this.pushStackLiteral("{}");
                var r = this.setupHelper(0, n, t)
                  , u = this.lastHelper = this.nameLookup("helpers", n, "helper")
                  , f = this.nameLookup("depth" + this.lastContext, n, "context")
                  , i = this.nextStack();
                this.pushSource("if (" + i + " = " + u + ") { " + i + " = " + i + ".call(" + r.callParams + "); }"),
                this.pushSource("else { " + i + " = " + f + "; " + i + " = typeof " + i + " === functionType ? " + i + ".call(" + r.callParams + ") : " + i + "; }")
            },
            invokePartial: function(n) {
                var t = [this.nameLookup("partials", n, "partial"), "'" + n + "'", this.popStack(), "helpers", "partials"];
                this.options.data && t.push("data"),
                this.context.aliases.self = "this",
                this.push("self.invokePartial(" + t.join(", ") + ")")
            },
            assignToHash: function(n) {
                var i, r, u = this.popStack(), t;
                this.options.stringParams && (r = this.popStack(),
                i = this.popStack()),
                t = this.hash,
                i && t.contexts.push("'" + n + "': " + i),
                r && t.types.push("'" + n + "': " + r),
                t.values.push("'" + n + "': (" + u + ")")
            },
            compiler: t,
            compileChildren: function(n, t) {
                for (var i, r, f, e = n.children, u = 0, o = e.length; o > u; u++)
                    r = e[u],
                    f = new this.compiler,
                    i = this.matchExistingProgram(r),
                    null  == i ? (this.context.programs.push(""),
                    i = this.context.programs.length,
                    r.index = i,
                    r.name = "program" + i,
                    this.context.programs[i] = f.compile(r, t, this.context),
                    this.context.environments[i] = r) : (r.index = i,
                    r.name = "program" + i)
            },
            matchExistingProgram: function(n) {
                for (var i, t = 0, r = this.context.environments.length; r > t; t++)
                    if (i = this.context.environments[t],
                    i && i.equals(n))
                        return t
            },
            programExpression: function(n) {
                if (this.context.aliases.self = "this",
                null  == n)
                    return "self.noop";
                for (var t, i = this.environment.children[n], r = i.depths.list, u = [i.index, i.name, "data"], f = 0, e = r.length; e > f; f++)
                    t = r[f],
                    1 === t ? u.push("depth0") : u.push("depth" + (t - 1));
                return (0 === r.length ? "self.program(" : "self.programWithDepth(") + u.join(", ") + ")"
            },
            register: function(n, t) {
                this.useRegister(n),
                this.pushSource(n + " = " + t + ";")
            },
            useRegister: function(n) {
                this.registers[n] || (this.registers[n] = !0,
                this.registers.list.push(n))
            },
            pushStackLiteral: function(n) {
                return this.push(new i(n))
            },
            pushSource: function(n) {
                this.pendingContent && (this.source.push(this.appendToBuffer(this.quotedString(this.pendingContent))),
                this.pendingContent = void 0),
                n && this.source.push(n)
            },
            pushStack: function(n) {
                this.flushInline();
                var t = this.incrStack();
                return n && this.pushSource(t + " = " + n + ";"),
                this.compileStack.push(t),
                t
            },
            replaceStack: function(n) {
                var t, u = "", e = this.isInline(), r, o, f;
                return e ? (r = this.popStack(!0),
                r instanceof i ? t = r.value : (o = this.stackSlot ? this.topStackName() : this.incrStack(),
                u = "(" + this.push(o) + " = " + r + "),",
                t = this.topStack())) : t = this.topStack(),
                f = n.call(this, t),
                e ? ((this.inlineStack.length || this.compileStack.length) && this.popStack(),
                this.push("(" + u + f + ")")) : (/^stack/.test(t) || (t = this.nextStack()),
                this.pushSource(t + " = (" + u + f + ");")),
                t
            },
            nextStack: function() {
                return this.pushStack()
            },
            incrStack: function() {
                return this.stackSlot++,
                this.stackSlot > this.stackVars.length && this.stackVars.push("stack" + this.stackSlot),
                this.topStackName()
            },
            topStackName: function() {
                return "stack" + this.stackSlot
            },
            flushInline: function() {
                var r = this.inlineStack, n, u, t;
                if (r.length)
                    for (this.inlineStack = [],
                    n = 0,
                    u = r.length; u > n; n++)
                        t = r[n],
                        t instanceof i ? this.compileStack.push(t) : this.pushStack(t)
            },
            isInline: function() {
                return this.inlineStack.length
            },
            popStack: function(n) {
                var r = this.isInline()
                  , t = (r ? this.inlineStack : this.compileStack).pop();
                return !n && t instanceof i ? t.value : (r || this.stackSlot--,
                t)
            },
            topStack: function(n) {
                var r = this.isInline() ? this.inlineStack : this.compileStack
                  , t = r[r.length - 1];
                return !n && t instanceof i ? t.value : t
            },
            quotedString: function(n) {
                return '"' + n.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029") + '"'
            },
            setupHelper: function(n, t, i) {
                var r = [], u;
                return this.setupParams(n, r, i),
                u = this.nameLookup("helpers", t, "helper"),
                {
                    params: r,
                    name: u,
                    callParams: ["depth0"].concat(r).join(", "),
                    helperMissingParams: i && ["depth0", this.quotedString(t)].concat(r).join(", ")
                }
            },
            setupParams: function(n, t, i) {
                var o, u, f, r = [], s = [], h = [], e;
                for (r.push("hash:" + this.popStack()),
                u = this.popStack(),
                f = this.popStack(),
                (f || u) && (f || (this.context.aliases.self = "this",
                f = "self.noop"),
                u || (this.context.aliases.self = "this",
                u = "self.noop"),
                r.push("inverse:" + u),
                r.push("fn:" + f)),
                e = 0; n > e; e++)
                    o = this.popStack(),
                    t.push(o),
                    this.options.stringParams && (h.push(this.popStack()),
                    s.push(this.popStack()));
                return this.options.stringParams && (r.push("contexts:[" + s.join(",") + "]"),
                r.push("types:[" + h.join(",") + "]"),
                r.push("hashContexts:hashContexts"),
                r.push("hashTypes:hashTypes")),
                this.options.data && r.push("data:data"),
                r = "{" + r.join(",") + "}",
                i ? (this.register("options", r),
                t.push("options")) : t.push(r),
                t.join(", ")
            }
        };
        for (var f = "break else new var case finally return void catch for switch while continue function this with default if throw delete in try do instanceof typeof abstract enum int short boolean export interface static byte extends long super char final native synchronized class float package throws const goto private transient debugger implements protected volatile double import public let yield".split(" "), h = t.RESERVED_WORDS = {}, r = 0, c = f.length; c > r; r++)
            h[f[r]] = !0;
        return t.isValidJavaScriptVariableName = function(n) {
            return !t.RESERVED_WORDS[n] && /^[a-zA-Z_$][0-9a-zA-Z_$]+$/.test(n) ? !0 : !1
        }
        ,
        e = t
    }(i)
      , c = function(n, t, i, r) {
        "use strict";
        function u() {}
        function c(n, t) {
            if (null  == n || "string" != typeof n && n.constructor !== h.ProgramNode)
                throw new e("You must pass a string or Handlebars AST to Handlebars.precompile. You passed " + n);
            t = t || {},
            "data" in t || (t.data = !0);
            var i = o(n)
              , r = (new u).compile(i, t);
            return (new s).compile(r, t)
        }
        function l(n, t, i) {
            function f() {
                var r = o(n)
                  , f = (new u).compile(r, t)
                  , e = (new s).compile(f, t, void 0, !0);
                return i.template(e)
            }
            if (null  == n || "string" != typeof n && n.constructor !== h.ProgramNode)
                throw new e("You must pass a string or Handlebars AST to Handlebars.compile. You passed " + n);
            t = t || {},
            "data" in t || (t.data = !0);
            var r;
            return function(n, t) {
                return r || (r = f()),
                r.call(this, n, t)
            }
        }
        var f = {}
          , e = n
          , o = t.parse
          , s = i
          , h = r;
        return f.Compiler = u,
        u.prototype = {
            compiler: u,
            disassemble: function() {
                for (var i, n, r, t, e = this.opcodes, u = [], f = 0, o = e.length; o > f; f++)
                    if (n = e[f],
                    "DECLARE" === n.opcode)
                        u.push("DECLARE " + n.name + "=" + n.value);
                    else {
                        for (r = [],
                        i = 0; i < n.args.length; i++)
                            t = n.args[i],
                            "string" == typeof t && (t = '"' + t.replace("\n", "\\n") + '"'),
                            r.push(t);
                        u.push(n.opcode + " " + r.join(" "))
                    }
                return u.join("\n")
            },
            equals: function(n) {
                var i = this.opcodes.length, t, r, f, u;
                if (n.opcodes.length !== i)
                    return !1;
                for (t = 0; i > t; t++) {
                    if (r = this.opcodes[t],
                    f = n.opcodes[t],
                    r.opcode !== f.opcode || r.args.length !== f.args.length)
                        return !1;
                    for (u = 0; u < r.args.length; u++)
                        if (r.args[u] !== f.args[u])
                            return !1
                }
                if (i = this.children.length,
                n.children.length !== i)
                    return !1;
                for (t = 0; i > t; t++)
                    if (!this.children[t].equals(n.children[t]))
                        return !1;
                return !0
            },
            guid: 0,
            compile: function(n, t) {
                var i, r;
                if (this.opcodes = [],
                this.children = [],
                this.depths = {
                    list: []
                },
                this.options = t,
                i = this.options.knownHelpers,
                this.options.knownHelpers = {
                    helperMissing: !0,
                    blockHelperMissing: !0,
                    each: !0,
                    "if": !0,
                    unless: !0,
                    "with": !0,
                    log: !0
                },
                i)
                    for (r in i)
                        this.options.knownHelpers[r] = i[r];
                return this.accept(n)
            },
            accept: function(n) {
                var t, i = n.strip || {};
                return i.left && this.opcode("strip"),
                t = this[n.type](n),
                i.right && this.opcode("strip"),
                t
            },
            program: function(n) {
                for (var i = n.statements, t = 0, r = i.length; r > t; t++)
                    this.accept(i[t]);
                return this.isSimple = 1 === r,
                this.depths.list = this.depths.list.sort(function(n, t) {
                    return n - t
                }),
                this
            },
            compileProgram: function(n) {
                var r, t = (new this.compiler).compile(n, this.options), u = this.guid++, i, f;
                for (this.usePartial = this.usePartial || t.usePartial,
                this.children[u] = t,
                i = 0,
                f = t.depths.list.length; f > i; i++)
                    r = t.depths.list[i],
                    2 > r || this.addDepth(r - 1);
                return u
            },
            block: function(n) {
                var r = n.mustache, t = n.program, i = n.inverse, u;
                t && (t = this.compileProgram(t)),
                i && (i = this.compileProgram(i)),
                u = this.classifyMustache(r),
                "helper" === u ? this.helperMustache(r, t, i) : "simple" === u ? (this.simpleMustache(r),
                this.opcode("pushProgram", t),
                this.opcode("pushProgram", i),
                this.opcode("emptyHash"),
                this.opcode("blockValue")) : (this.ambiguousMustache(r, t, i),
                this.opcode("pushProgram", t),
                this.opcode("pushProgram", i),
                this.opcode("emptyHash"),
                this.opcode("ambiguousBlockValue")),
                this.opcode("append")
            },
            hash: function(n) {
                var r, t, u = n.pairs, i, f;
                for (this.opcode("pushHash"),
                i = 0,
                f = u.length; f > i; i++)
                    r = u[i],
                    t = r[1],
                    this.options.stringParams ? (t.depth && this.addDepth(t.depth),
                    this.opcode("getContext", t.depth || 0),
                    this.opcode("pushStringParam", t.stringModeValue, t.type)) : this.accept(t),
                    this.opcode("assignToHash", r[0]);
                this.opcode("popHash")
            },
            partial: function(n) {
                var t = n.partialName;
                this.usePartial = !0,
                n.context ? this.ID(n.context) : this.opcode("push", "depth0"),
                this.opcode("invokePartial", t.name),
                this.opcode("append")
            },
            content: function(n) {
                this.opcode("appendContent", n.string)
            },
            mustache: function(n) {
                var i = this.options
                  , t = this.classifyMustache(n);
                "simple" === t ? this.simpleMustache(n) : "helper" === t ? this.helperMustache(n) : this.ambiguousMustache(n),
                n.escaped && !i.noEscape ? this.opcode("appendEscaped") : this.opcode("append")
            },
            ambiguousMustache: function(n, t, i) {
                var r = n.id
                  , u = r.parts[0]
                  , f = null  != t || null  != i;
                this.opcode("getContext", r.depth),
                this.opcode("pushProgram", t),
                this.opcode("pushProgram", i),
                this.opcode("invokeAmbiguous", u, f)
            },
            simpleMustache: function(n) {
                var t = n.id;
                "DATA" === t.type ? this.DATA(t) : t.parts.length ? this.ID(t) : (this.addDepth(t.depth),
                this.opcode("getContext", t.depth),
                this.opcode("pushContext")),
                this.opcode("resolvePossibleLambda")
            },
            helperMustache: function(n, t, i) {
                var u = this.setupFullMustacheParams(n, t, i)
                  , r = n.id.parts[0];
                if (this.options.knownHelpers[r])
                    this.opcode("invokeKnownHelper", u.length, r);
                else {
                    if (this.options.knownHelpersOnly)
                        throw new Error("You specified knownHelpersOnly, but used the unknown helper " + r);
                    this.opcode("invokeHelper", u.length, r)
                }
            },
            ID: function(n) {
                var i, t, r;
                for (this.addDepth(n.depth),
                this.opcode("getContext", n.depth),
                i = n.parts[0],
                i ? this.opcode("lookupOnContext", n.parts[0]) : this.opcode("pushContext"),
                t = 1,
                r = n.parts.length; r > t; t++)
                    this.opcode("lookup", n.parts[t])
            },
            DATA: function(n) {
                if (this.options.data = !0,
                n.id.isScoped || n.id.depth)
                    throw new e("Scoped data references are not supported: " + n.original);
                this.opcode("lookupData");
                for (var i = n.id.parts, t = 0, r = i.length; r > t; t++)
                    this.opcode("lookup", i[t])
            },
            STRING: function(n) {
                this.opcode("pushString", n.string)
            },
            INTEGER: function(n) {
                this.opcode("pushLiteral", n.integer)
            },
            BOOLEAN: function(n) {
                this.opcode("pushLiteral", n.bool)
            },
            comment: function() {},
            opcode: function(n) {
                this.opcodes.push({
                    opcode: n,
                    args: [].slice.call(arguments, 1)
                })
            },
            declare: function(n, t) {
                this.opcodes.push({
                    opcode: "DECLARE",
                    name: n,
                    value: t
                })
            },
            addDepth: function(n) {
                if (isNaN(n))
                    throw new Error("EWOT");
                0 !== n && (this.depths[n] || (this.depths[n] = !0,
                this.depths.list.push(n)))
            },
            classifyMustache: function(n) {
                var t = n.isHelper, i = n.eligibleHelper, r = this.options, u;
                return i && !t && (u = n.id.parts[0],
                r.knownHelpers[u] ? t = !0 : r.knownHelpersOnly && (i = !1)),
                t ? "helper" : i ? "ambiguous" : "simple"
            },
            pushParams: function(n) {
                for (var t, i = n.length; i--; )
                    t = n[i],
                    this.options.stringParams ? (t.depth && this.addDepth(t.depth),
                    this.opcode("getContext", t.depth || 0),
                    this.opcode("pushStringParam", t.stringModeValue, t.type)) : this[t.type](t)
            },
            setupMustacheParams: function(n) {
                var t = n.params;
                return this.pushParams(t),
                n.hash ? this.hash(n.hash) : this.opcode("emptyHash"),
                t
            },
            setupFullMustacheParams: function(n, t, i) {
                var r = n.params;
                return this.pushParams(r),
                this.opcode("pushProgram", t),
                this.opcode("pushProgram", i),
                n.hash ? this.hash(n.hash) : this.opcode("emptyHash"),
                r
            }
        },
        f.precompile = c,
        f.compile = l,
        f
    }(n, f, e, r);
    return function(n, t, i, r, u) {
        "use strict";
        var o, f = n, s = t, h = i.parser, c = i.parse, l = r.Compiler, a = r.compile, v = r.precompile, y = u, p = f.create, e = function() {
            var n = p();
            return n.compile = function(t, i) {
                return a(t, i, n)
            }
            ,
            n.precompile = v,
            n.AST = s,
            n.Compiler = l,
            n.JavaScriptCompiler = y,
            n.Parser = h,
            n.parse = c,
            n
        }
        ;
        return f = e(),
        f.create = e,
        o = f
    }(s, r, f, c, e)
}(), InternalExternalFlag, PersonManager;
!function(n) {
    var t = {
        isMsie: function() {
            return /(msie|trident)/i.test(navigator.userAgent) ? navigator.userAgent.match(/(msie |rv:)(\d+(.\d+)?)/i)[2] : !1
        },
        isBlankString: function(n) {
            return !n || /^\s*$/.test(n)
        },
        escapeRegExChars: function(n) {
            return n.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
        },
        isString: function(n) {
            return "string" == typeof n
        },
        isNumber: function(n) {
            return "number" == typeof n
        },
        isArray: n.isArray,
        isFunction: n.isFunction,
        isObject: n.isPlainObject,
        isUndefined: function(n) {
            return "undefined" == typeof n
        },
        bind: n.proxy,
        each: function(t, i) {
            function r(n, t) {
                return i(t, n)
            }
            n.each(t, r)
        },
        map: n.map,
        filter: n.grep,
        every: function(t, i) {
            var r = !0;
            return t ? (n.each(t, function(n, u) {
                if (!(r = i.call(null , u, n, t)))
                    return !1
            }),
            !!r) : r
        },
        some: function(t, i) {
            var r = !1;
            return t ? (n.each(t, function(n, u) {
                if (r = i.call(null , u, n, t))
                    return !1
            }),
            !!r) : r
        },
        mixin: n.extend,
        getUniqueId: function() {
            var n = 0;
            return function() {
                return n++
            }
        }(),
        templatify: function(t) {
            function i() {
                return String(t)
            }
            return n.isFunction(t) ? t : i
        },
        defer: function(n) {
            setTimeout(n, 0)
        },
        debounce: function(n, t, i) {
            var r, u;
            return function() {
                var f, e, o = this, s = arguments;
                return f = function() {
                    r = null ,
                    i || (u = n.apply(o, s))
                }
                ,
                e = i && !r,
                clearTimeout(r),
                r = setTimeout(f, t),
                e && (u = n.apply(o, s)),
                u
            }
        },
        throttle: function(n, t) {
            var u, f, i, e, r, o;
            return r = 0,
            o = function() {
                r = new Date,
                i = null ,
                e = n.apply(u, f)
            }
            ,
            function() {
                var s = new Date
                  , h = t - (s - r);
                return u = this,
                f = arguments,
                0 >= h ? (clearTimeout(i),
                i = null ,
                r = s,
                e = n.apply(u, f)) : i || (i = setTimeout(o, h)),
                e
            }
        },
        noop: function() {}
    }, l = "0.10.2", a = function() {
        function n(n) {
            return n.split(/\s+/)
        }
        function t(n) {
            return n.split(/\W+/)
        }
        function i(n) {
            return function(t) {
                return function(i) {
                    return n(i[t])
                }
            }
        }
        return {
            nonword: t,
            whitespace: n,
            obj: {
                nonword: i(t),
                whitespace: i(n)
            }
        }
    }(), o = function() {
        function n(n) {
            this.maxSize = n || 100,
            this.size = 0,
            this.hash = {},
            this.list = new i
        }
        function i() {
            this.head = this.tail = null 
        }
        function r(n, t) {
            this.key = n,
            this.val = t,
            this.prev = this.next = null 
        }
        return t.mixin(n.prototype, {
            set: function(n, t) {
                var i, u = this.list.tail;
                this.size >= this.maxSize && (this.list.remove(u),
                delete this.hash[u.key]),
                (i = this.hash[n]) ? (i.val = t,
                this.list.moveToFront(i)) : (i = new r(n,t),
                this.list.add(i),
                this.hash[n] = i,
                this.size++)
            },
            get: function(n) {
                var t = this.hash[n];
                if (t)
                    return this.list.moveToFront(t),
                    t.val
            }
        }),
        t.mixin(i.prototype, {
            add: function(n) {
                this.head && (n.next = this.head,
                this.head.prev = n),
                this.head = n,
                this.tail = this.tail || n
            },
            remove: function(n) {
                n.prev ? n.prev.next = n.next : this.head = n.next,
                n.next ? n.next.prev = n.prev : this.tail = n.prev
            },
            moveToFront: function(n) {
                this.remove(n),
                this.add(n)
            }
        }),
        n
    }(), v = function() {
        function i(n) {
            this.prefix = ["__", n, "__"].join(""),
            this.ttlKey = "__ttl__",
            this.keyMatcher = new RegExp("^" + this.prefix)
        }
        function r() {
            return +new Date
        }
        function u(n) {
            return JSON.stringify(t.isUndefined(n) ? null  : n)
        }
        function f(n) {
            return JSON.parse(n)
        }
        var n, e;
        try {
            n = window.localStorage,
            n.setItem("~~~", "!"),
            n.removeItem("~~~")
        } catch (o) {
            n = null 
        }
        return e = n && window.JSON ? {
            _prefix: function(n) {
                return this.prefix + n
            },
            _ttlKey: function(n) {
                return this._prefix(n) + this.ttlKey
            },
            get: function(t) {
                return this.isExpired(t) && this.remove(t),
                f(n.getItem(this._prefix(t)))
            },
            set: function(i, f, e) {
                return t.isNumber(e) ? n.setItem(this._ttlKey(i), u(r() + e)) : n.removeItem(this._ttlKey(i)),
                n.setItem(this._prefix(i), u(f))
            },
            remove: function(t) {
                return n.removeItem(this._ttlKey(t)),
                n.removeItem(this._prefix(t)),
                this
            },
            clear: function() {
                for (var r, i = [], u = n.length, t = 0; u > t; t++)
                    (r = n.key(t)).match(this.keyMatcher) && i.push(r.replace(this.keyMatcher, ""));
                for (t = i.length; t--; )
                    this.remove(i[t]);
                return this
            },
            isExpired: function(i) {
                var u = f(n.getItem(this._ttlKey(i)));
                return t.isNumber(u) && r() > u ? !0 : !1
            }
        } : {
            get: t.noop,
            set: t.noop,
            remove: t.noop,
            clear: t.noop,
            isExpired: t.noop
        },
        t.mixin(i.prototype, e),
        i
    }(), s = function() {
        function i(t) {
            t = t || {},
            this._send = t.transport ? s(t.transport) : n.ajax,
            this._get = t.rateLimiter ? t.rateLimiter(this._get) : this._get
        }
        function s(i) {
            return function(r, u) {
                function e(n) {
                    t.defer(function() {
                        f.resolve(n)
                    })
                }
                function o(n) {
                    t.defer(function() {
                        f.reject(n)
                    })
                }
                var f = n.Deferred();
                return i(r, u, e, o),
                f
            }
        }
        var r = 0
          , u = {}
          , e = 6
          , f = new o(10);
        return i.setMaxPendingRequests = function(n) {
            e = n
        }
        ,
        i.resetCache = function() {
            f = new o(10)
        }
        ,
        t.mixin(i.prototype, {
            _get: function(n, t, i) {
                function s(t) {
                    i && i(null , t),
                    f.set(n, t)
                }
                function h() {
                    i && i(!0)
                }
                function l() {
                    r--,
                    delete u[n],
                    o.onDeckRequestArgs && (o._get.apply(o, o.onDeckRequestArgs),
                    o.onDeckRequestArgs = null )
                }
                var c, o = this;
                (c = u[n]) ? c.done(s).fail(h) : e > r ? (r++,
                u[n] = this._send(n, t).done(s).fail(h).always(l)) : this.onDeckRequestArgs = [].slice.call(arguments, 0)
            },
            get: function(n, i, r) {
                var u;
                return t.isFunction(i) && (r = i,
                i = {}),
                (u = f.get(n)) ? t.defer(function() {
                    r && r(null , u)
                }) : this._get(n, i, r),
                !!u
            }
        }),
        i
    }(), y = function() {
        function i(t) {
            t = t || {},
            t.datumTokenizer && t.queryTokenizer || n.error("datumTokenizer and queryTokenizer are both required"),
            this.datumTokenizer = t.datumTokenizer,
            this.queryTokenizer = t.queryTokenizer,
            this.reset()
        }
        function r(n) {
            return n = t.filter(n, function(n) {
                return !!n
            }),
            n = t.map(n, function(n) {
                return n.toLowerCase()
            })
        }
        function u() {
            return {
                ids: [],
                children: {}
            }
        }
        function f(n) {
            for (var i = {}, r = [], t = 0; t < n.length; t++)
                i[n[t]] || (i[n[t]] = !0,
                r.push(n[t]));
            return r
        }
        function e(n, t) {
            function u(n, t) {
                return n - t
            }
            var i = 0
              , r = 0
              , f = [];
            for (n = n.sort(u),
            t = t.sort(u); i < n.length && r < t.length; )
                n[i] < t[r] ? i++ : n[i] > t[r] ? r++ : (f.push(n[i]),
                i++,
                r++);
            return f
        }
        return t.mixin(i.prototype, {
            bootstrap: function(n) {
                this.datums = n.datums,
                this.trie = n.trie
            },
            add: function(n) {
                var i = this;
                n = t.isArray(n) ? n : [n],
                t.each(n, function(n) {
                    var f, e;
                    f = i.datums.push(n) - 1,
                    e = r(i.datumTokenizer(n)),
                    t.each(e, function(n) {
                        for (var r, t = i.trie, e = n.split(""); r = e.shift(); )
                            t = t.children[r] || (t.children[r] = u()),
                            t.ids.push(f)
                    })
                })
            },
            get: function(n) {
                var u, i, o = this;
                return u = r(this.queryTokenizer(n)),
                t.each(u, function(n) {
                    var t, r, f, u;
                    if (i && 0 === i.length)
                        return !1;
                    for (t = o.trie,
                    r = n.split(""); t && (f = r.shift()); )
                        t = t.children[f];
                    return t && 0 === r.length ? (u = t.ids.slice(0),
                    void (i = i ? e(i, u) : u)) : (i = [],
                    !1)
                }),
                i ? t.map(f(i), function(n) {
                    return o.datums[n]
                }) : []
            },
            reset: function() {
                this.datums = [],
                this.trie = u()
            },
            serialize: function() {
                return {
                    datums: this.datums,
                    trie: this.trie
                }
            }
        }),
        i
    }(), f = function() {
        function i(n) {
            return n.local || null 
        }
        function r(i) {
            var r, u;
            return u = {
                url: null ,
                thumbprint: "",
                ttl: 864e5,
                filter: null ,
                ajax: {}
            },
            (r = i.prefetch || null ) && (r = t.isString(r) ? {
                url: r
            } : r,
            r = t.mixin(u, r),
            r.thumbprint = l + r.thumbprint,
            r.ajax.type = r.ajax.type || "GET",
            r.ajax.dataType = r.ajax.dataType || "json",
            !r.url && n.error("prefetch requires url to be set")),
            r
        }
        function u(i) {
            function f(n) {
                return function(i) {
                    return t.debounce(i, n)
                }
            }
            function e(n) {
                return function(i) {
                    return t.throttle(i, n)
                }
            }
            var r, u;
            return u = {
                url: null ,
                wildcard: "%QUERY",
                replace: null ,
                rateLimitBy: "debounce",
                rateLimitWait: 300,
                send: null ,
                filter: null ,
                ajax: {}
            },
            (r = i.remote || null ) && (r = t.isString(r) ? {
                url: r
            } : r,
            r = t.mixin(u, r),
            r.rateLimiter = /^throttle$/i.test(r.rateLimitBy) ? e(r.rateLimitWait) : f(r.rateLimitWait),
            r.ajax.type = r.ajax.type || "GET",
            r.ajax.dataType = r.ajax.dataType || "json",
            delete r.rateLimitBy,
            delete r.rateLimitWait,
            !r.url && n.error("remote requires url to be set")),
            r
        }
        return {
            local: i,
            prefetch: r,
            remote: u
        }
    }(), r, i;
    !function(i) {
        function u(t) {
            t && (t.local || t.prefetch || t.remote) || n.error("one of local, prefetch, or remote is required"),
            this.limit = t.limit || 5,
            this.sorter = o(t.sorter),
            this.dupDetector = t.dupDetector || h,
            this.local = f.local(t),
            this.prefetch = f.prefetch(t),
            this.remote = f.remote(t),
            this.cacheKey = this.prefetch ? this.prefetch.cacheKey || this.prefetch.url : null ,
            this.index = new y({
                datumTokenizer: t.datumTokenizer,
                queryTokenizer: t.queryTokenizer
            }),
            this.storage = this.cacheKey ? new v(this.cacheKey) : null 
        }
        function o(n) {
            function i(t) {
                return t.sort(n)
            }
            function r(n) {
                return n
            }
            return t.isFunction(n) ? i : r
        }
        function h() {
            return !1
        }
        var e, r;
        return e = i.Bloodhound,
        r = {
            data: "data",
            protocol: "protocol",
            thumbprint: "thumbprint"
        },
        i.Bloodhound = u,
        u.noConflict = function() {
            return i.Bloodhound = e,
            u
        }
        ,
        u.tokenizers = a,
        t.mixin(u.prototype, {
            _loadPrefetch: function(t) {
                function f(n) {
                    i.clear(),
                    i.add(t.filter ? t.filter(n) : n),
                    i._saveToStorage(i.index.serialize(), t.thumbprint, t.ttl)
                }
                var u, r, i = this;
                return (u = this._readFromStorage(t.thumbprint)) ? (this.index.bootstrap(u),
                r = n.Deferred().resolve()) : r = n.ajax(t.url, t.ajax).done(f),
                r
            },
            _getFromRemote: function(n, t) {
                function f(n, i) {
                    t(n ? [] : u.remote.filter ? u.remote.filter(i) : i)
                }
                var i, r, u = this;
                return n = n || "",
                r = encodeURIComponent(n),
                i = this.remote.replace ? this.remote.replace(this.remote.url, n) : this.remote.url.replace(this.remote.wildcard, r),
                this.transport.get(i, this.remote.ajax, f)
            },
            _saveToStorage: function(n, t, i) {
                this.storage && (this.storage.set(r.data, n, i),
                this.storage.set(r.protocol, location.protocol, i),
                this.storage.set(r.thumbprint, t, i))
            },
            _readFromStorage: function(n) {
                var i, t = {};
                return this.storage && (t.data = this.storage.get(r.data),
                t.protocol = this.storage.get(r.protocol),
                t.thumbprint = this.storage.get(r.thumbprint)),
                i = t.thumbprint !== n || t.protocol !== location.protocol,
                t.data && !i ? t.data : null 
            },
            _initialize: function() {
                function u() {
                    f.add(t.isFunction(i) ? i() : i)
                }
                var r, f = this, i = this.local;
                return r = this.prefetch ? this._loadPrefetch(this.prefetch) : n.Deferred().resolve(),
                i && r.done(u),
                this.transport = this.remote ? new s(this.remote) : null ,
                this.initPromise = r.promise()
            },
            initialize: function(n) {
                return !this.initPromise || n ? this._initialize() : this.initPromise
            },
            add: function(n) {
                this.index.add(n)
            },
            get: function(n, i) {
                function e(n) {
                    var f = r.slice(0);
                    t.each(n, function(n) {
                        var i;
                        return i = t.some(f, function(t) {
                            return u.dupDetector(n, t)
                        }),
                        !i && f.push(n),
                        f.length < u.limit
                    }),
                    i && i(u.sorter(f))
                }
                var u = this
                  , r = []
                  , f = !1;
                r = this.index.get(n),
                r = this.sorter(r).slice(0, this.limit),
                r.length < this.limit && this.transport && (f = this._getFromRemote(n, e)),
                f || (r.length > 0 || !this.transport) && i && i(r)
            },
            clear: function() {
                this.index.reset()
            },
            clearPrefetchCache: function() {
                this.storage && this.storage.clear()
            },
            clearRemoteCache: function() {
                this.transport && s.resetCache()
            },
            ttAdapter: function() {
                return t.bind(this.get, this)
            }
        }),
        u
    }(this),
    r = {
        wrapper: '<span class="twitter-typeahead"><\/span>',
        dropdown: '<span class="tt-dropdown-menu"><\/span>',
        dataset: '<div class="tt-dataset-%CLASS%"><\/div>',
        suggestions: '<span class="tt-suggestions"><\/span>',
        suggestion: '<div class="tt-suggestion"><\/div>'
    },
    i = {
        wrapper: {
            position: "relative",
            display: "inline-block"
        },
        hint: {
            position: "absolute",
            top: "0",
            left: "0",
            borderColor: "transparent",
            boxShadow: "none"
        },
        input: {
            position: "relative",
            verticalAlign: "top",
            backgroundColor: "transparent"
        },
        inputWithNoHint: {
            position: "relative",
            verticalAlign: "top"
        },
        dropdown: {
            position: "absolute",
            top: "100%",
            left: "0",
            zIndex: "100",
            display: "none"
        },
        suggestions: {
            display: "block"
        },
        suggestion: {
            whiteSpace: "nowrap",
            cursor: "pointer"
        },
        suggestionChild: {
            whiteSpace: "normal"
        },
        ltr: {
            left: "0",
            right: "auto"
        },
        rtl: {
            left: "auto",
            right: " 0"
        }
    },
    t.isMsie() && t.mixin(i.input, {
        backgroundImage: "url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)"
    }),
    t.isMsie() && t.isMsie() <= 7 && t.mixin(i.input, {
        marginTop: "-1px"
    });
    var h = function() {
        function i(t) {
            t && t.el || n.error("EventBus initialized without el"),
            this.$el = n(t.el)
        }
        var r = "typeahead:";
        return t.mixin(i.prototype, {
            trigger: function(n) {
                var t = [].slice.call(arguments, 1);
                this.$el.trigger(r + n, t)
            }
        }),
        i
    }()
      , e = function() {
        function t(t, i, r, u) {
            var f;
            if (!r)
                return this;
            for (i = i.split(n),
            r = u ? s(r, u) : r,
            this._callbacks = this._callbacks || {}; f = i.shift(); )
                this._callbacks[f] = this._callbacks[f] || {
                    sync: [],
                    async: []
                },
                this._callbacks[f][t].push(r);
            return this
        }
        function r(n, i, r) {
            return t.call(this, "async", n, i, r)
        }
        function u(n, i, r) {
            return t.call(this, "sync", n, i, r)
        }
        function f(t) {
            var i;
            if (!this._callbacks)
                return this;
            for (t = t.split(n); i = t.shift(); )
                delete this._callbacks[i];
            return this
        }
        function e(t) {
            var r, u, f, e, o;
            if (!this._callbacks)
                return this;
            for (t = t.split(n),
            f = [].slice.call(arguments, 1); (r = t.shift()) && (u = this._callbacks[r]); )
                e = i(u.sync, this, [r].concat(f)),
                o = i(u.async, this, [r].concat(f)),
                e() && h(o);
            return this
        }
        function i(n, t, i) {
            function r() {
                for (var r, u = 0; !r && u < n.length; u += 1)
                    r = n[u].apply(t, i) === !1;
                return !r
            }
            return r
        }
        function o() {
            var n;
            return n = window.setImmediate ? function(n) {
                setImmediate(function() {
                    n()
                })
            }
             : function(n) {
                setTimeout(function() {
                    n()
                }, 0)
            }
        }
        function s(n, t) {
            return n.bind ? n.bind(t) : function() {
                n.apply(t, [].slice.call(arguments, 0))
            }
        }
        var n = /\s+/
          , h = o();
        return {
            onSync: u,
            onAsync: r,
            off: f,
            trigger: e
        }
    }()
      , p = function(n) {
        function i(n, i, r) {
            for (var u, f = [], e = 0; e < n.length; e++)
                f.push(t.escapeRegExChars(n[e]));
            return u = r ? "\\b(" + f.join("|") + ")\\b" : "(" + f.join("|") + ")",
            i ? new RegExp(u) : new RegExp(u,"i")
        }
        var r = {
            node: null ,
            pattern: null ,
            tagName: "strong",
            className: null ,
            wordsOnly: !1,
            caseSensitive: !1
        };
        return function(u) {
            function o(t) {
                var i, r;
                return (i = e.exec(t.data)) && (wrapperNode = n.createElement(u.tagName),
                u.className && (wrapperNode.className = u.className),
                r = t.splitText(i.index),
                r.splitText(i[0].length),
                wrapperNode.appendChild(r.cloneNode(!0)),
                t.parentNode.replaceChild(wrapperNode, r)),
                !!i
            }
            function f(n, t) {
                for (var i, u = 3, r = 0; r < n.childNodes.length; r++)
                    i = n.childNodes[r],
                    i.nodeType === u ? r += t(i) ? 1 : 0 : f(i, t)
            }
            var e;
            u = t.mixin({}, r, u),
            u.node && u.pattern && (u.pattern = t.isArray(u.pattern) ? u.pattern : [u.pattern],
            e = i(u.pattern, u.caseSensitive, u.wordsOnly),
            f(u.node, o))
        }
    }(window.document)
      , c = function() {
        function i(i) {
            var r, e, o, s, h = this;
            i = i || {},
            i.input || n.error("input is missing"),
            r = t.bind(this._onBlur, this),
            e = t.bind(this._onFocus, this),
            o = t.bind(this._onKeydown, this),
            s = t.bind(this._onInput, this),
            this.$hint = n(i.hint),
            this.$input = n(i.input).on("blur.tt", r).on("focus.tt", e).on("keydown.tt", o),
            0 === this.$hint.length && (this.setHint = this.getHint = this.clearHint = this.clearHintIfInvalid = t.noop),
            t.isMsie() ? this.$input.on("keydown.tt keypress.tt cut.tt paste.tt", function(n) {
                u[n.which || n.keyCode] || t.defer(t.bind(h._onInput, h, n))
            }) : this.$input.on("input.tt", s),
            this.query = this.$input.val(),
            this.$overflowHelper = f(this.$input)
        }
        function f(t) {
            return n('<pre aria-hidden="true"><\/pre>').css({
                position: "absolute",
                visibility: "hidden",
                whiteSpace: "pre",
                fontFamily: t.css("font-family"),
                fontSize: t.css("font-size"),
                fontStyle: t.css("font-style"),
                fontVariant: t.css("font-variant"),
                fontWeight: t.css("font-weight"),
                wordSpacing: t.css("word-spacing"),
                letterSpacing: t.css("letter-spacing"),
                textIndent: t.css("text-indent"),
                textRendering: t.css("text-rendering"),
                textTransform: t.css("text-transform")
            }).insertAfter(t)
        }
        function o(n, t) {
            return i.normalizeQuery(n) === i.normalizeQuery(t)
        }
        function r(n) {
            return n.altKey || n.ctrlKey || n.metaKey || n.shiftKey
        }
        var u;
        return u = {
            9: "tab",
            27: "esc",
            37: "left",
            39: "right",
            13: "enter",
            38: "up",
            40: "down"
        },
        i.normalizeQuery = function(n) {
            return (n || "").replace(/^\s*/g, "").replace(/\s{2,}/g, " ")
        }
        ,
        t.mixin(i.prototype, e, {
            _onBlur: function() {
                this.resetInputValue(),
                this.trigger("blurred")
            },
            _onFocus: function() {
                this.trigger("focused")
            },
            _onKeydown: function(n) {
                var t = u[n.which || n.keyCode];
                this._managePreventDefault(t, n),
                t && this._shouldTrigger(t, n) && this.trigger(t + "Keyed", n)
            },
            _onInput: function() {
                this._checkInputValue()
            },
            _managePreventDefault: function(n, t) {
                var i, u, f;
                switch (n) {
                case "tab":
                    u = this.getHint(),
                    f = this.getInputValue(),
                    i = u && u !== f && !r(t);
                    break;
                case "up":
                case "down":
                    i = !r(t);
                    break;
                default:
                    i = !1
                }
                i && t.preventDefault()
            },
            _shouldTrigger: function(n, t) {
                var i;
                switch (n) {
                case "tab":
                    i = !r(t);
                    break;
                default:
                    i = !0
                }
                return i
            },
            _checkInputValue: function() {
                var n, t, i;
                n = this.getInputValue(),
                t = o(n, this.query),
                i = t ? this.query.length !== n.length : !1,
                t ? i && this.trigger("whitespaceChanged", this.query) : this.trigger("queryChanged", this.query = n)
            },
            focus: function() {
                this.$input.focus()
            },
            blur: function() {
                this.$input.blur()
            },
            getQuery: function() {
                return this.query
            },
            setQuery: function(n) {
                this.query = n
            },
            getInputValue: function() {
                return this.$input.val()
            },
            setInputValue: function(n, t) {
                this.$input.val(n),
                t ? this.clearHint() : this._checkInputValue()
            },
            resetInputValue: function() {
                this.setInputValue(this.query, !0)
            },
            getHint: function() {
                return this.$hint.val()
            },
            setHint: function(n) {
                this.$hint.val(n)
            },
            clearHint: function() {
                this.setHint("")
            },
            clearHintIfInvalid: function() {
                var n, t, i, r;
                n = this.getInputValue(),
                t = this.getHint(),
                i = n !== t && 0 === t.indexOf(n),
                r = "" !== n && i && !this.hasOverflow(),
                !r && this.clearHint()
            },
            getLanguageDirection: function() {
                return (this.$input.css("direction") || "ltr").toLowerCase()
            },
            hasOverflow: function() {
                var n = this.$input.width() - 2;
                return this.$overflowHelper.text(this.getInputValue()),
                this.$overflowHelper.width() >= n
            },
            isCursorAtEnd: function() {
                var n, i, r;
                return n = this.$input.val().length,
                i = this.$input[0].selectionStart,
                t.isNumber(i) ? i === n : document.selection ? (r = document.selection.createRange(),
                r.moveStart("character", -n),
                n === r.text.length) : !0
            },
            destroy: function() {
                this.$hint.off(".tt"),
                this.$input.off(".tt"),
                this.$hint = this.$input = this.$overflowHelper = null 
            }
        }),
        i
    }()
      , u = function() {
        function u(i) {
            i = i || {},
            i.templates = i.templates || {},
            i.source || n.error("missing source"),
            i.name && !l(i.name) && n.error("invalid dataset name: " + i.name),
            this.query = null ,
            this.highlight = !!i.highlight,
            this.name = i.name || t.getUniqueId(),
            this.source = i.source,
            this.displayFn = h(i.display || i.displayKey),
            this.templates = c(i.templates, this.displayFn),
            this.$el = n(r.dataset.replace("%CLASS%", this.name))
        }
        function h(n) {
            function i(t) {
                return t[n]
            }
            return n = n || "value",
            t.isFunction(n) ? n : i
        }
        function c(n, i) {
            function r(n) {
                return "<p>" + i(n) + "<\/p>"
            }
            return {
                empty: n.empty && t.templatify(n.empty),
                header: n.header && t.templatify(n.header),
                footer: n.footer && t.templatify(n.footer),
                suggestion: n.suggestion || r
            }
        }
        function l(n) {
            return /^[_a-zA-Z0-9-]+$/.test(n)
        }
        var f = "ttDataset"
          , o = "ttValue"
          , s = "ttDatum";
        return u.extractDatasetName = function(t) {
            return n(t).data(f)
        }
        ,
        u.extractValue = function(t) {
            return n(t).data(o)
        }
        ,
        u.extractDatum = function(t) {
            return n(t).data(s)
        }
        ,
        t.mixin(u.prototype, e, {
            _render: function(u, e) {
                function v() {
                    return h.templates.empty({
                        query: u,
                        isEmpty: !0
                    })
                }
                function y() {
                    function a(t) {
                        var u;
                        return u = n(r.suggestion).append(h.templates.suggestion(t)).data(f, h.name).data(o, h.displayFn(t)).data(s, t),
                        u.children().each(function() {
                            n(this).css(i.suggestionChild)
                        }),
                        u
                    }
                    var c, l;
                    return c = n(r.suggestions).css(i.suggestions),
                    l = t.map(e, a),
                    c.append.apply(c, l),
                    h.highlight && p({
                        node: c[0],
                        pattern: u
                    }),
                    c
                }
                function l() {
                    return h.templates.header({
                        query: u,
                        isEmpty: !c
                    })
                }
                function a() {
                    return h.templates.footer({
                        query: u,
                        isEmpty: !c
                    })
                }
                if (this.$el) {
                    var c, h = this;
                    this.$el.empty(),
                    c = e && e.length,
                    !c && this.templates.empty ? this.$el.html(v()).prepend(h.templates.header ? l() : null ).append(h.templates.footer ? a() : null ) : c && this.$el.html(y()).prepend(h.templates.header ? l() : null ).append(h.templates.footer ? a() : null ),
                    this.trigger("rendered")
                }
            },
            getRoot: function() {
                return this.$el
            },
            update: function(n) {
                function i(i) {
                    t.canceled || n !== t.query || t._render(n, i)
                }
                var t = this;
                this.query = n,
                this.canceled = !1,
                this.source(n, i)
            },
            cancel: function() {
                this.canceled = !0
            },
            clear: function() {
                this.cancel(),
                this.$el.empty(),
                this.trigger("rendered")
            },
            isEmpty: function() {
                return this.$el.is(":empty")
            },
            destroy: function() {
                this.$el = null 
            }
        }),
        u
    }()
      , w = function() {
        function r(i) {
            var u, e, o, r = this;
            i = i || {},
            i.menu || n.error("menu is required"),
            this.isOpen = !1,
            this.isEmpty = !0,
            this.datasets = t.map(i.datasets, f),
            u = t.bind(this._onSuggestionClick, this),
            e = t.bind(this._onSuggestionMouseEnter, this),
            o = t.bind(this._onSuggestionMouseLeave, this),
            this.$menu = n(i.menu).on("click.tt", ".tt-suggestion", u).on("mouseenter.tt", ".tt-suggestion", e).on("mouseleave.tt", ".tt-suggestion", o),
            t.each(this.datasets, function(n) {
                r.$menu.append(n.getRoot()),
                n.onSync("rendered", r._onRendered, r)
            })
        }
        function f(n) {
            return new u(n)
        }
        return t.mixin(r.prototype, e, {
            _onSuggestionClick: function(t) {
                this.trigger("suggestionClicked", n(t.currentTarget))
            },
            _onSuggestionMouseEnter: function(t) {
                this._removeCursor(),
                this._setCursor(n(t.currentTarget), !0)
            },
            _onSuggestionMouseLeave: function() {
                this._removeCursor()
            },
            _onRendered: function() {
                function n(n) {
                    return n.isEmpty()
                }
                this.isEmpty = t.every(this.datasets, n),
                this.isEmpty ? this._hide() : this.isOpen && this._show(),
                this.trigger("datasetRendered")
            },
            _hide: function() {
                this.$menu.hide()
            },
            _show: function() {
                this.$menu.css("display", "block")
            },
            _getSuggestions: function() {
                return this.$menu.find(".tt-suggestion")
            },
            _getCursor: function() {
                return this.$menu.find(".tt-cursor").first()
            },
            _setCursor: function(n, t) {
                n.first().addClass("tt-cursor"),
                t || this.trigger("cursorMoved")
            },
            _removeCursor: function() {
                this._getCursor().removeClass("tt-cursor")
            },
            _moveCursor: function(n) {
                var i, r, t, u;
                if (this.isOpen) {
                    if (r = this._getCursor(),
                    i = this._getSuggestions(),
                    this._removeCursor(),
                    t = i.index(r) + n,
                    t = (t + 1) % (i.length + 1) - 1,
                    -1 === t)
                        return void this.trigger("cursorRemoved");
                    -1 > t && (t = i.length - 1),
                    this._setCursor(u = i.eq(t)),
                    this._ensureVisible(u)
                }
            },
            _ensureVisible: function(n) {
                var t, i, r, u;
                t = n.position().top,
                i = t + n.outerHeight(!0),
                r = this.$menu.scrollTop(),
                u = this.$menu.height() + parseInt(this.$menu.css("paddingTop"), 10) + parseInt(this.$menu.css("paddingBottom"), 10),
                0 > t ? this.$menu.scrollTop(r + t) : i > u && this.$menu.scrollTop(r + (i - u))
            },
            close: function() {
                this.isOpen && (this.isOpen = !1,
                this._removeCursor(),
                this._hide(),
                this.trigger("closed"))
            },
            open: function() {
                this.isOpen || (this.isOpen = !0,
                !this.isEmpty && this._show(),
                this.trigger("opened"))
            },
            setLanguageDirection: function(n) {
                this.$menu.css("ltr" === n ? i.ltr : i.rtl)
            },
            moveCursorUp: function() {
                this._moveCursor(-1)
            },
            moveCursorDown: function() {
                this._moveCursor(1)
            },
            getDatumForSuggestion: function(n) {
                var t = null ;
                return n.length && (t = {
                    raw: u.extractDatum(n),
                    value: u.extractValue(n),
                    datasetName: u.extractDatasetName(n)
                }),
                t
            },
            getDatumForCursor: function() {
                return this.getDatumForSuggestion(this._getCursor().first())
            },
            getDatumForTopSuggestion: function() {
                return this.getDatumForSuggestion(this._getSuggestions().first())
            },
            update: function(n) {
                function i(t) {
                    t.update(n)
                }
                t.each(this.datasets, i)
            },
            empty: function() {
                function n(n) {
                    n.clear()
                }
                t.each(this.datasets, n),
                this.isEmpty = !0
            },
            isVisible: function() {
                return this.isOpen && !this.isEmpty
            },
            destroy: function() {
                function n(n) {
                    n.destroy()
                }
                this.$menu.off(".tt"),
                this.$menu = null ,
                t.each(this.datasets, n)
            }
        }),
        r
    }()
      , b = function() {
        function f(i) {
            var r, u, f;
            i = i || {},
            i.input || n.error("missing input"),
            this.isActivated = !1,
            this.autoselect = !!i.autoselect,
            this.minLength = t.isNumber(i.minLength) ? i.minLength : 1,
            this.$node = e(i.input, i.withHint),
            r = this.$node.find(".tt-dropdown-menu"),
            u = this.$node.find(".tt-input"),
            f = this.$node.find(".tt-hint"),
            u.on("blur.tt", function(n) {
                var i, f, e;
                i = document.activeElement,
                f = r.is(i),
                e = r.has(i).length > 0,
                t.isMsie() && (f || e) && (n.preventDefault(),
                n.stopImmediatePropagation(),
                t.defer(function() {
                    u.focus()
                }))
            }),
            r.on("mousedown.tt", function(n) {
                n.preventDefault()
            }),
            this.eventBus = i.eventBus || new h({
                el: u
            }),
            this.dropdown = new w({
                menu: r,
                datasets: i.datasets
            }).onSync("suggestionClicked", this._onSuggestionClicked, this).onSync("cursorMoved", this._onCursorMoved, this).onSync("cursorRemoved", this._onCursorRemoved, this).onSync("opened", this._onOpened, this).onSync("closed", this._onClosed, this).onAsync("datasetRendered", this._onDatasetRendered, this),
            this.input = new c({
                input: u,
                hint: f
            }).onSync("focused", this._onFocused, this).onSync("blurred", this._onBlurred, this).onSync("enterKeyed", this._onEnterKeyed, this).onSync("tabKeyed", this._onTabKeyed, this).onSync("escKeyed", this._onEscKeyed, this).onSync("upKeyed", this._onUpKeyed, this).onSync("downKeyed", this._onDownKeyed, this).onSync("leftKeyed", this._onLeftKeyed, this).onSync("rightKeyed", this._onRightKeyed, this).onSync("queryChanged", this._onQueryChanged, this).onSync("whitespaceChanged", this._onWhitespaceChanged, this),
            this._setLanguageDirection()
        }
        function e(t, f) {
            var e, h, c, s;
            e = n(t),
            h = n(r.wrapper).css(i.wrapper),
            c = n(r.dropdown).css(i.dropdown),
            s = e.clone().css(i.hint).css(o(e)),
            s.val("").removeData().addClass("tt-hint").removeAttr("id name placeholder").prop("disabled", !0).attr({
                autocomplete: "off",
                spellcheck: "false"
            }),
            e.data(u, {
                dir: e.attr("dir"),
                autocomplete: e.attr("autocomplete"),
                spellcheck: e.attr("spellcheck"),
                style: e.attr("style")
            }),
            e.addClass("tt-input").attr({
                autocomplete: "off",
                spellcheck: !1
            }).css(f ? i.input : i.inputWithNoHint);
            try {
                e.attr("dir") || e.attr("dir", "auto")
            } catch (l) {}
            return e.wrap(h).parent().prepend(f ? s : null ).append(c)
        }
        function o(n) {
            return {
                backgroundAttachment: n.css("background-attachment"),
                backgroundClip: n.css("background-clip"),
                backgroundColor: n.css("background-color"),
                backgroundImage: n.css("background-image"),
                backgroundOrigin: n.css("background-origin"),
                backgroundPosition: n.css("background-position"),
                backgroundRepeat: n.css("background-repeat"),
                backgroundSize: n.css("background-size")
            }
        }
        function s(n) {
            var i = n.find(".tt-input");
            t.each(i.data(u), function(n, r) {
                t.isUndefined(n) ? i.removeAttr(r) : i.attr(r, n)
            }),
            i.detach().removeData(u).removeClass("tt-input").insertAfter(n),
            n.remove()
        }
        var u = "ttAttrs";
        return t.mixin(f.prototype, {
            _onSuggestionClicked: function(n, t) {
                var i;
                (i = this.dropdown.getDatumForSuggestion(t)) && this._select(i)
            },
            _onCursorMoved: function() {
                var n = this.dropdown.getDatumForCursor();
                this.input.setInputValue(n.value, !0),
                this.eventBus.trigger("cursorchanged", n.raw, n.datasetName)
            },
            _onCursorRemoved: function() {
                this.input.resetInputValue(),
                this._updateHint()
            },
            _onDatasetRendered: function() {
                this._updateHint()
            },
            _onOpened: function() {
                this._updateHint(),
                this.eventBus.trigger("opened")
            },
            _onClosed: function() {
                this.input.clearHint(),
                this.eventBus.trigger("closed")
            },
            _onFocused: function() {
                this.isActivated = !0,
                this.dropdown.open()
            },
            _onBlurred: function() {
                this.isActivated = !1,
                this.dropdown.empty(),
                this.dropdown.close()
            },
            _onEnterKeyed: function(n, t) {
                var i, r;
                i = this.dropdown.getDatumForCursor(),
                r = this.dropdown.getDatumForTopSuggestion(),
                i ? (this._select(i),
                t.preventDefault()) : this.autoselect && r && (this._select(r),
                t.preventDefault())
            },
            _onTabKeyed: function(n, t) {
                var i;
                (i = this.dropdown.getDatumForCursor()) ? (this._select(i),
                t.preventDefault()) : this._autocomplete(!0)
            },
            _onEscKeyed: function() {
                this.dropdown.close(),
                this.input.resetInputValue()
            },
            _onUpKeyed: function() {
                var n = this.input.getQuery();
                this.dropdown.isEmpty && n.length >= this.minLength ? this.dropdown.update(n) : this.dropdown.moveCursorUp(),
                this.dropdown.open()
            },
            _onDownKeyed: function() {
                var n = this.input.getQuery();
                this.dropdown.isEmpty && n.length >= this.minLength ? this.dropdown.update(n) : this.dropdown.moveCursorDown(),
                this.dropdown.open()
            },
            _onLeftKeyed: function() {
                "rtl" === this.dir && this._autocomplete()
            },
            _onRightKeyed: function() {
                "ltr" === this.dir && this._autocomplete()
            },
            _onQueryChanged: function(n, t) {
                this.input.clearHintIfInvalid(),
                t.length >= this.minLength ? this.dropdown.update(t) : this.dropdown.empty(),
                this.dropdown.open(),
                this._setLanguageDirection()
            },
            _onWhitespaceChanged: function() {
                this._updateHint(),
                this.dropdown.open()
            },
            _setLanguageDirection: function() {
                var n;
                this.dir !== (n = this.input.getLanguageDirection()) && (this.dir = n,
                this.$node.css("direction", n),
                this.dropdown.setLanguageDirection(n))
            },
            _updateHint: function() {
                var n, i, u, f, e, r;
                n = this.dropdown.getDatumForTopSuggestion(),
                n && this.dropdown.isVisible() && !this.input.hasOverflow() ? (i = this.input.getInputValue(),
                u = c.normalizeQuery(i),
                f = t.escapeRegExChars(u),
                e = new RegExp("^(?:" + f + ")(.+$)","i"),
                r = e.exec(n.value),
                r ? this.input.setHint(i + r[1]) : this.input.clearHint()) : this.input.clearHint()
            },
            _autocomplete: function(n) {
                var i, r, u, t;
                i = this.input.getHint(),
                r = this.input.getQuery(),
                u = n || this.input.isCursorAtEnd(),
                i && r !== i && u && (t = this.dropdown.getDatumForTopSuggestion(),
                t && this.input.setInputValue(t.value),
                this.eventBus.trigger("autocompleted", t.raw, t.datasetName))
            },
            _select: function(n) {
                this.input.setQuery(n.value),
                this.input.setInputValue(n.value, !0),
                this._setLanguageDirection(),
                this.eventBus.trigger("selected", n.raw, n.datasetName),
                this.dropdown.close(),
                t.defer(t.bind(this.dropdown.empty, this.dropdown))
            },
            open: function() {
                this.dropdown.open()
            },
            close: function() {
                this.dropdown.close()
            },
            setVal: function(n) {
                this.isActivated ? this.input.setInputValue(n) : (this.input.setQuery(n),
                this.input.setInputValue(n, !0)),
                this._setLanguageDirection()
            },
            getVal: function() {
                return this.input.getQuery()
            },
            destroy: function() {
                this.input.destroy(),
                this.dropdown.destroy(),
                s(this.$node),
                this.$node = null 
            }
        }),
        f
    }();
    !function() {
        var u, i, r;
        u = n.fn.typeahead,
        i = "ttTypeahead",
        r = {
            initialize: function(r, u) {
                function f() {
                    var o, e, f = n(this);
                    t.each(u, function(n) {
                        n.highlight = !!r.highlight
                    }),
                    e = new b({
                        input: f,
                        eventBus: o = new h({
                            el: f
                        }),
                        withHint: t.isUndefined(r.hint) ? !0 : !!r.hint,
                        minLength: r.minLength,
                        autoselect: r.autoselect,
                        datasets: u
                    }),
                    f.data(i, e)
                }
                return u = t.isArray(u) ? u : [].slice.call(arguments, 1),
                r = r || {},
                this.each(f)
            },
            open: function() {
                function t() {
                    var t, r = n(this);
                    (t = r.data(i)) && t.open()
                }
                return this.each(t)
            },
            close: function() {
                function t() {
                    var t, r = n(this);
                    (t = r.data(i)) && t.close()
                }
                return this.each(t)
            },
            val: function(t) {
                function r() {
                    var r, u = n(this);
                    (r = u.data(i)) && r.setVal(t)
                }
                function u(n) {
                    var t, r;
                    return (t = n.data(i)) && (r = t.getVal()),
                    r
                }
                return arguments.length ? this.each(r) : u(this.first())
            },
            destroy: function() {
                function t() {
                    var t, r = n(this);
                    (t = r.data(i)) && (t.destroy(),
                    r.removeData(i))
                }
                return this.each(t)
            }
        },
        n.fn.typeahead = function(n) {
            return r[n] ? r[n].apply(this, [].slice.call(arguments, 1)) : r.initialize.apply(this, arguments)
        }
        ,
        n.fn.typeahead.noConflict = function() {
            return n.fn.typeahead = u,
            this
        }
    }()
}(window.jQuery),
function(n, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define(t) : n.Spinner = t()
}(this, function() {
    "use strict";
    function i(n, t) {
        var i, r = document.createElement(n || "div");
        for (i in t)
            r[i] = t[i];
        return r
    }
    function t(n) {
        for (var t = 1, i = arguments.length; i > t; t++)
            n.appendChild(arguments[t]);
        return n
    }
    function a(n, t, i, r) {
        var f = ["opacity", t, ~~(100 * n), i, r].join("-")
          , e = .01 + 100 * (i / r)
          , s = Math.max(1 - (1 - n) / t * (100 - e), n)
          , h = u.substring(0, u.indexOf("Animation")).toLowerCase()
          , c = h && "-" + h + "-" || "";
        return l[f] || (o.insertRule("@" + c + "keyframes " + f + "{0%{opacity:" + s + "}" + e + "%{opacity:" + n + "}" + (e + .01) + "%{opacity:1}" + (e + t) % 100 + "%{opacity:" + n + "}100%{opacity:" + s + "}}", o.cssRules.length),
        l[f] = 1),
        f
    }
    function e(n, t) {
        var r, i, u = n.style;
        for (t = t.charAt(0).toUpperCase() + t.slice(1),
        i = 0; c.length > i; i++)
            if (r = c[i] + t,
            void 0 !== u[r])
                return r;
        if (void 0 !== u[t])
            return t
    }
    function n(n, t) {
        for (var i in t)
            n.style[e(n, i) || i] = t[i];
        return n
    }
    function s(n) {
        for (var r, i, t = 1; arguments.length > t; t++) {
            r = arguments[t];
            for (i in r)
                void 0 === n[i] && (n[i] = r[i])
        }
        return n
    }
    function h(n, t) {
        return "string" == typeof n ? n : n[t % n.length]
    }
    function r(n) {
        this.opts = s(n || {}, r.defaults, y)
    }
    function v() {
        function u(n, t) {
            return i("<" + n + ' xmlns="urn:schemas-microsoft.com:vml" class="spin-vml">', t)
        }
        o.addRule(".spin-vml", "behavior:url(#default#VML)"),
        r.prototype.lines = function(i, r) {
            function s() {
                return n(u("group", {
                    coordsize: o + " " + o,
                    coordorigin: -e + " " + -e
                }), {
                    width: o,
                    height: o
                })
            }
            function c(i, f, o) {
                t(a, t(n(s(), {
                    rotation: 360 / r.lines * i + "deg",
                    left: ~~f
                }), t(n(u("roundrect", {
                    arcsize: r.corners
                }), {
                    width: e,
                    height: r.width,
                    left: r.radius,
                    top: -r.width >> 1,
                    filter: o
                }), u("fill", {
                    color: h(r.color, i),
                    opacity: r.opacity
                }), u("stroke", {
                    opacity: 0
                }))))
            }
            var f, e = r.length + r.width, o = 2 * e, l = 2 * -(r.width + r.length) + "px", a = n(s(), {
                position: "absolute",
                top: l,
                left: l
            });
            if (r.shadow)
                for (f = 1; r.lines >= f; f++)
                    c(f, -2, "progid:DXImageTransform.Microsoft.Blur(pixelradius=2,makeshadow=1,shadowopacity=.3)");
            for (f = 1; r.lines >= f; f++)
                c(f);
            return t(i, a)
        }
        ,
        r.prototype.opacity = function(n, t, i, r) {
            var u = n.firstChild;
            r = r.shadow && r.lines || 0,
            u && u.childNodes.length > t + r && (u = u.childNodes[t + r],
            u = u && u.firstChild,
            u = u && u.firstChild,
            u && (u.opacity = i))
        }
    }
    var u, c = ["webkit", "Moz", "ms", "O"], l = {}, o = function() {
        var n = i("style", {
            type: "text/css"
        });
        return t(document.getElementsByTagName("head")[0], n),
        n.sheet || n.styleSheet
    }(), y = {
        lines: 12,
        length: 7,
        width: 5,
        radius: 10,
        rotate: 0,
        corners: 1,
        color: "#000",
        direction: 1,
        speed: 1,
        trail: 100,
        opacity: .25,
        fps: 20,
        zIndex: 2e9,
        className: "spinner",
        top: "50%",
        left: "50%",
        position: "absolute"
    }, f;
    return r.defaults = {},
    s(r.prototype, {
        spin: function(t) {
            this.stop();
            var f = this
              , r = f.opts
              , e = f.el = n(i(0, {
                className: r.className
            }), {
                position: r.position,
                width: 0,
                zIndex: r.zIndex
            });
            if (r.radius + r.length + r.width,
            n(e, {
                left: r.left,
                top: r.top
            }),
            t && t.insertBefore(e, t.firstChild || null ),
            e.setAttribute("role", "progressbar"),
            f.lines(e, f.opts),
            !u) {
                var s, h = 0, l = (r.lines - 1) * (1 - r.direction) / 2, c = r.fps, o = c / r.speed, a = (1 - r.opacity) / (o * r.trail / 100), v = o / r.lines;
                (function y() {
                    h++;
                    for (var n = 0; r.lines > n; n++)
                        s = Math.max(1 - (h + (r.lines - n) * v) % o * a, r.opacity),
                        f.opacity(e, n * r.direction + l, s, r);
                    f.timeout = f.el && setTimeout(y, ~~(1e3 / c))
                })()
            }
            return f
        },
        stop: function() {
            var n = this.el;
            return n && (clearTimeout(this.timeout),
            n.parentNode && n.parentNode.removeChild(n),
            this.el = void 0),
            this
        },
        lines: function(r, f) {
            function s(t, r) {
                return n(i(), {
                    position: "absolute",
                    width: f.length + f.width + "px",
                    height: f.width + "px",
                    background: t,
                    boxShadow: r,
                    transformOrigin: "left",
                    transform: "rotate(" + ~~(360 / f.lines * e + f.rotate) + "deg) translate(" + f.radius + "px,0)",
                    borderRadius: (f.corners * f.width >> 1) + "px"
                })
            }
            for (var o, e = 0, c = (f.lines - 1) * (1 - f.direction) / 2; f.lines > e; e++)
                o = n(i(), {
                    position: "absolute",
                    top: 1 + ~(f.width / 2) + "px",
                    transform: f.hwaccel ? "translate3d(0,0,0)" : "",
                    opacity: f.opacity,
                    animation: u && a(f.opacity, f.trail, c + e * f.direction, f.lines) + " " + 1 / f.speed + "s linear infinite"
                }),
                f.shadow && t(o, n(s("#000", "0 0 4px #000"), {
                    top: "2px"
                })),
                t(r, t(o, s(h(f.color, e), "0 0 1px rgba(0,0,0,.1)")));
            return r
        },
        opacity: function(n, t, i) {
            n.childNodes.length > t && (n.childNodes[t].style.opacity = i)
        }
    }),
    f = n(i("group"), {
        behavior: "url(#default#VML)"
    }),
    !e(f, "transform") && f.adj ? v() : u = e(f, "animation"),
    r
}),
function(n, t) {
    "object" == typeof exports ? module.exports = t(require("spin.js")) : "function" == typeof define && define.amd ? define(["spin"], t) : n.Ladda = t(n.Spinner)
}(this, function(n) {
    "use strict";
    function i(n) {
        var i, f, r, u;
        return n === void 0 ? (console.warn("Ladda button target must be defined."),
        void 0) : (n.querySelector(".ladda-label") || (n.innerHTML = '<span class="ladda-label">' + n.innerHTML + "<\/span>"),
        f = document.createElement("span"),
        f.className = "ladda-spinner",
        n.appendChild(f),
        u = {
            start: function() {
                return i || (i = o(n)),
                n.setAttribute("disabled", ""),
                n.setAttribute("data-loading", ""),
                clearTimeout(r),
                i.spin(f),
                this.setProgress(0),
                this
            },
            startAfter: function(n) {
                return clearTimeout(r),
                r = setTimeout(function() {
                    u.start()
                }, n),
                this
            },
            stop: function() {
                return n.removeAttribute("disabled"),
                n.removeAttribute("data-loading"),
                clearTimeout(r),
                i && (r = setTimeout(function() {
                    i.stop()
                }, 1e3)),
                this
            },
            toggle: function() {
                return this.isLoading() ? this.stop() : this.start(),
                this
            },
            setProgress: function(t) {
                t = Math.max(Math.min(t, 1), 0);
                var i = n.querySelector(".ladda-progress");
                0 === t && i && i.parentNode ? i.parentNode.removeChild(i) : (i || (i = document.createElement("div"),
                i.className = "ladda-progress",
                n.appendChild(i)),
                i.style.width = (t || 0) * n.offsetWidth + "px")
            },
            enable: function() {
                return this.stop(),
                this
            },
            disable: function() {
                return this.stop(),
                n.setAttribute("disabled", ""),
                this
            },
            isLoading: function() {
                return n.hasAttribute("data-loading")
            },
            remove: function() {
                clearTimeout(r),
                n.removeAttribute("disabled", ""),
                n.removeAttribute("data-loading", ""),
                i && (i.stop(),
                i = null );
                for (var f = 0, e = t.length; e > f; f++)
                    if (u === t[f]) {
                        t.splice(f, 1);
                        break
                    }
            }
        },
        t.push(u),
        u)
    }
    function r(n, t) {
        for (; n.parentNode && n.tagName !== t; )
            n = n.parentNode;
        if (t === n.tagName)
            return n
    }
    function u(n) {
        for (var i, t, u = ["input", "textarea"], f = [], r = 0; u.length > r; r++)
            for (i = n.getElementsByTagName(u[r]),
            t = 0; i.length > t; t++)
                i[t].hasAttribute("required") && f.push(i[t]);
        return f
    }
    function f(n, t) {
        var f, e, o;
        for (t = t || {},
        f = [],
        "string" == typeof n ? f = s(document.querySelectorAll(n)) : "object" == typeof n && "string" == typeof n.nodeName && (f = [n]),
        e = 0,
        o = f.length; o > e; e++)
            (function() {
                var n = f[e], o, s;
                "function" == typeof n.addEventListener && (o = i(n),
                s = -1,
                n.addEventListener("click", function() {
                    var e = !0, h = r(n, "FORM"), f, i;
                    if (h !== void 0)
                        for (f = u(h),
                        i = 0; f.length > i; i++)
                            "" === f[i].value.replace(/^\s+|\s+$/g, "") && (e = !1);
                    e && (o.startAfter(1),
                    "number" == typeof t.timeout && (clearTimeout(s),
                    s = setTimeout(o.stop, t.timeout)),
                    "function" == typeof t.callback && t.callback.apply(null , [o]))
                }, !1))
            })()
    }
    function e() {
        for (var n = 0, i = t.length; i > n; n++)
            t[n].stop()
    }
    function o(t) {
        var u, i = t.offsetHeight;
        0 === i && (i = parseFloat(window.getComputedStyle(t).height)),
        i > 32 && (i *= .8),
        t.hasAttribute("data-spinner-size") && (i = parseInt(t.getAttribute("data-spinner-size"), 10)),
        t.hasAttribute("data-spinner-color") && (u = t.getAttribute("data-spinner-color"));
        var f = 12
          , r = .2 * i
          , e = .6 * r
          , o = 7 > r ? 2 : 3;
        return new n({
            color: u || "#fff",
            lines: f,
            radius: r,
            length: e,
            width: o,
            zIndex: "auto",
            top: "auto",
            left: "auto",
            className: ""
        })
    }
    function s(n) {
        for (var i = [], t = 0; n.length > t; t++)
            i.push(n[t]);
        return i
    }
    var t = [];
    return {
        bind: f,
        create: i,
        stopAll: e
    }
}),
InternalExternalFlag = {
    All: 1,
    Internal: 2,
    External: 3
},
PersonManager = function() {
    function s(t, i, r, u) {
        $.ajax(n + "/" + t + "/Contacts", {
            method: "GET"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
    function h(n) {
        return !Enum || !Enum.RoleEnum || !n ? !1 : user.isInRole(Enum.RoleEnum.ExternalPeopleManagement.Id, n)
    }
    function c(t, i, r, u) {
        var f = 1
          , e = 50
          , o = []
          , s = function(i, r, u, f, e) {
            $.ajax(n + "/Search", {
                contentType: "application/json",
                data: {
                    EntityIds: [t],
                    EntitiesAssignedToIds: [t],
                    IsDeleted: !1,
                    PageIndex: i,
                    PageSize: r
                },
                method: "GET",
                cache: !1
            }).done(function(n) {
                _.each(n.Results, function(n) {
                    o.push(n)
                }),
                u && u(null , n)
            }).fail(function(n) {
                f && f(n)
            }).always(function(n) {
                e && e(n)
            })
        }
        ;
        s(f, e, function(n, t) {
            for (var h = Math.ceil(t.TotalPeople / e) - 1, u = [], r = 0; r < h; r++)
                u.push(function(n) {
                    f++,
                    s(f, e, n)
                });
            async.parallelLimit(u, 5, function() {
                i(o)
            })
        }, r, u)
    }
    var n = urls.Api.people
      , t = function(t, i, r, u) {
        $.ajax(n + "/GetSimplePerson", {
            contentType: "application/json",
            data: {
                id: t
            },
            method: "GET"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
      , i = function(t, i, r, u) {
        $.ajax(n + "/GetManagePerson", {
            contentType: "application/json",
            data: {
                id: t
            },
            method: "GET"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
      , r = function(t, i, r, u) {
        switch (t.External) {
        case InternalExternalFlag.Internal:
            data.External = !1;
            break;
        case InternalExternalFlag.External:
            t.External = !0
        }
        $.ajax(n + "/Search", {
            contentType: "application/json",
            data: t,
            method: "GET",
            cache: !1
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
      , u = function(t, i, r, u, f) {
        i !== undefined && i !== null  && (t.contacts = i),
        $.ajax(n + "/External", {
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify(t),
            method: "POST"
        }).done(function(n) {
            r && r(n)
        }).fail(function(n) {
            u && u(n)
        }).always(function(n) {
            f && f(n)
        })
    }
      , f = function(t, i, r, u, f) {
        i !== undefined && i !== null  && (t.contacts = i),
        $.ajax(n + "/External", {
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify(t),
            method: "PUT"
        }).done(function(n) {
            r && r(n)
        }).fail(function(n) {
            u && u(n)
        }).always(function(n) {
            f && f(n)
        })
    }
      , e = function(t, i, r, u) {
        t && $.ajax(n + "/" + t + "/External/", {
            method: "DELETE"
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
      , o = function(t, i, r, u) {
        t && $.ajax(n + "/External/BulkDelete", {
            method: "POST",
            data: {
                Ids: t
            }
        }).done(function(n) {
            i && i(n)
        }).fail(function(n) {
            r && r(n)
        }).always(function(n) {
            u && u(n)
        })
    }
    ;
    return {
        GetPersonById: t,
        GetManagePersonById: i,
        GetContactsForPerson: s,
        SearchPeople: r,
        CreateExternalPerson: u,
        UpdateExternalPerson: f,
        DeleteExternalPerson: e,
        BulkDeleteExternalPeople: o,
        CanManageExternalPerson: h,
        GetPeopleByEntityId: c
    }
}
,
$(function() {
    var n = new CreateMessageViewModel, f, t, i, r, u;
    n.errors = ko.validation.group({
        selectedRecipients: n.selectedRecipients,
        messageText: n.messageText,
        operational: n.operational
    }),
    n.customRecipientErrors = ko.validation.group({
        contactDetail: n.contactDetail,
        contactDescription: n.contactDescription
    }),
    f = new PersonManager,
    $("input#contact").val(""),
    ko.applyBindings(n, document.getElementById("content")),
    t = new Bloodhound({
        datumTokenizer: function(n) {
            return Bloodhound.tokenizers.whitespace(n.pretty_address)
        },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        limit: 5,
        remote: {
            url: urls.Api.contactGroups + "/Search",
            replace: function(n, t) {
                return n + "?Name=" + t + "&PageIndex=1&PageSize=5"
            },
            filter: function(n) {
                return n.Results.map(function(n) {
                    return n.Type = "Contact Group",
                    n
                })
            }
        }
    }),
    t.initialize(),
    i = new Bloodhound({
        datumTokenizer: function(n) {
            return Bloodhound.tokenizers.whitespace(n.pretty_address)
        },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        limit: 5,
        remote: {
            url: urls.Api.entities + "/Search",
            replace: function(n, t) {
                return n + "?EntityName=" + t + "&PageIndex=1&PageSize=5"
            },
            filter: function(n) {
                return n.Results.map(function(n) {
                    return n.Type = "Entity",
                    n
                })
            }
        }
    }),
    i.initialize(),
    r = new Bloodhound({
        datumTokenizer: function(n) {
            return Bloodhound.tokenizers.whitespace(n.team)
        },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        remote: {
            url: urls.Api.people + "/Search?",
            replace: function(n, t) {
                var r = t.split(" ")
                  , i = {
                    FirstName: t,
                    LastName: t,
                    RegistrationNumber: t,
                    External: !1,
                    IsDeleted: !1,
                    PageIndex: 1,
                    PageSize: 5
                };
                return r.length > 1 && (i.FirstName = r[0],
                i.LastName = r[1],
                i.RegistrationNumber = null ),
                n + jQuery.param(i)
            },
            filter: function(n) {
                return n.Results.map(function(n) {
                    return n.Type = "Person",
                    n
                })
            }
        }
    }),
    u = new Bloodhound({
        datumTokenizer: function(n) {
            return Bloodhound.tokenizers.whitespace(n.team)
        },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        remote: {
            url: urls.Api.people + "/Search?",
            replace: function(n, t) {
                var r = t.split(" ")
                  , i = {
                    FirstName: t,
                    LastName: t,
                    RegistrationNumber: t,
                    External: !0,
                    IsDeleted: !1,
                    PageIndex: 1,
                    PageSize: 5
                };
                return r.length > 1 && (i.FirstName = r[0],
                i.LastName = r[1],
                i.RegistrationNumber = null ),
                n + jQuery.param(i)
            },
            filter: function(n) {
                return n.Results.map(function(n) {
                    return n.Type = "Person",
                    n
                })
            }
        }
    }),
    r.initialize(),
    u.initialize();
    $("input#contact").typeahead({
        highlight: !0
    }, {
        name: "internal",
        displayKey: "FullName",
        source: r.ttAdapter(),
        templates: {
            header: '<h3 class="external-section">SES Members<\/h3>',
            suggestion: Handlebars.compile('<p class="repo-language">{{FirstName}} {{LastName}} ({{RegistrationNumber}})<\/p>')
        }
    }, {
        name: "external",
        displayKey: "FullName",
        source: u.ttAdapter(),
        templates: {
            header: '<h3 class="external-section">External<\/h3>',
            suggestion: Handlebars.compile('<p class="repo-language">{{FirstName}} {{LastName}} ({{ExternalAgency}})<\/p>')
        }
    }, {
        name: "headquarters",
        displayKey: "Name",
        source: i.ttAdapter(),
        templates: {
            header: '<h3 class="external-section">Headquarters<\/h3>',
            suggestion: Handlebars.compile('<p class="repo-language">{{Name}}<\/p>')
        }
    }, {
        name: "contactgroups",
        displayKey: "Name",
        source: t.ttAdapter(),
        templates: {
            header: '<h3 class="external-section">Contact Groups<\/h3>',
            suggestion: Handlebars.compile('<p class="repo-language">{{Name}} ({{Entity.Name}})<\/p>')
        }
    }).on("typeahead:selected typeahead:autocompleted", function(t, i) {
        n.setSelectedHeadquarters(null ),
        n.setSelectedPerson(null ),
        i.Type == "Entity" ? n.setSelectedHeadquarters(i) : i.Type == "Person" ? f.GetPersonById(i.Id, function(t) {
            n.setSelectedPerson(t)
        }) : (n.addContactGroup(i),
        $("input#contact").typeahead("val", ""))
    })
})
