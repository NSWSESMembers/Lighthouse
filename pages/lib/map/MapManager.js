const $ = require('jquery');
const DOM = require('jsx-dom-factory');

const lighthouseIcon = chrome.extension.getURL('icons/lh-black.png');
const teamIcon = chrome.extension.getURL('icons/bus.png');
const helicopterIcon = chrome.extension.getURL('icons/helicopter.png');
const rfsIcon = chrome.extension.getURL('icons/rfs_emergency.png');
const lhqIcon = chrome.extension.getURL('icons/ses.png');
const rmsIcon = chrome.extension.getURL('icons/rms.png');
const rfscorpIcon = chrome.extension.getURL('icons/rfs.png');
const sesIcon = chrome.extension.getURL('icons/ses_corp.png');

/**
 * A class for helping out with map layer access.
 */
module.exports = class MapManager {

    /**
     * Creates a menu for the map layers.
     *
     * @returns {*|jQuery|HTMLElement}
     */
    static createLayerMenu() {
        return $(<li id="lhlayers">
            <a href="#" class="js-sub-menu-toggle">
                <img src={lighthouseIcon} style="width:14px;vertical-align:top;margin-right:10px;float:left" />
                <span class="text">Lighthouse</span>
                <i class="toggle-icon fa fa-angle-left"></i>
            </a>
            <ul class="sub-menu ">
                <li>
                    <a class="js-sub-sub-menu-toggle" href="#">
                        <img src={sesIcon} style="width:14px;vertical-align:sub;margin-left:-12px;" />
                        <span class="text toggle-tag-text">NSW SES</span>
                    </a>
                    <ul class="sub-sub-menu">
                        <li class="clearfix">
                    <span id="togglelhqsBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src={lhqIcon} />
                        <span class="tag-text">SES LHQs</span>
                    </span>
                            <span id="toggleSesTeamsBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src={teamIcon} />
                        <span class="tag-text">SES Team Locations</span>
                    </span>
                        </li>
                    </ul>
                </li>
                <li>
                    <a class="js-sub-sub-menu-toggle" href="#">
                        <img src={rmsIcon} style="margin-top:4px;width:14px;vertical-align:top;margin-left:-12px;float:left" />
                        <span class="text toggle-tag-text">Roads and Maritime Services</span>
                    </a>
                    <ul class="sub-sub-menu">
                        <li class="clearfix">
                    <span id="toggleRmsIncidentsBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/images/icons/hazard/traffic-incident.gif" />
                        <span class="tag-text">RMS Incidents</span>
                    </span>
                            <span id="toggleRmsFloodingBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/images/icons/hazard/weather-flood.gif" />
                        <span class="tag-text">RMS Flood Reports</span>
                    </span>
                            <span id="toggleRmsCamerasBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/images/icons/traffic-conditions/traffic-web-camera.gif" />
                        <span class="tag-text">RMS Cameras</span>
                    </span>
                        </li>
                    </ul>
                </li>
                <li>
                    <a class="js-sub-sub-menu-toggle" href="#">
                        <img src={rfscorpIcon} style="width:14px;vertical-align:top;margin-left:-12px;float:left" />
                        <span class="text toggle-tag-text">NSW Rural Fire Service</span>
                    </a>
                    <ul class="sub-sub-menu">
                        <li class="clearfix">
                    <span id="toggleRfsIncidentsBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src={rfsIcon} />
                        <span class="tag-text">RFS Incidents</span>
                    </span>
                        </li>
                    </ul>
                </li>
                <li>
                    <a class="js-sub-sub-menu-toggle" href="#">
                        <i class="toggle-icon-sub fa fa-bell"></i>
                        <span class="text toggle-tag-text">Other</span>
                    </a>
                    <ul class="sub-sub-menu">
                        <li class="clearfix">
                    <span id="toggleHelicoptersBtn" class="label tag tag-lh-filter tag-disabled">
                        <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src={helicopterIcon} />
                        <span class="tag-text">Rescue Helicopters</span>
                    </span>
                            <span id="togglePowerOutagesBtn" class="label tag tag-lh-filter tag-disabled">
                        <span class="glyphicon glyphicon-flash" aria-hidden="true"></span>
                        <span class="tag-text">Power Outages</span>
                    </span>
                        </li>
                    </ul>
                </li>
            </ul>
        </li>);
    }
};
