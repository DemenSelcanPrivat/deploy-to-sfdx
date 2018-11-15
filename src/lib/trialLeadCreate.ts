// asynchronously posts the lead form back to org62
// const request = require('request');
import * as request from 'request-promise-native';

const sfdcLeadCaptureServlet = process.env.sfdcLeadCaptureServlet;
const requestPage = '/form.html';
const resultPage = '/conf.html';
const requestHost = 'www.salesforce.com';


const leadCreate = async function (incoming) {

	console.log(incoming);

	const formPostBody = {
		UserFirstName: incoming.UserFirstName,
		UserLastName: incoming.UserLastName,
		CompanyName: incoming.CompanyName,
		UserTitle: incoming.UserTitle,
		UserEmail: incoming.UserEmail,
		UserPhone: incoming.UserPhone,
		CompanyState: incoming.CompanyState,
		CompanyPostalCode: incoming.CompanyPostalCode,
		CompanyEmployees: incoming.CompanyEmployees,
		CompanyCountry: incoming.CompanyCountry,
		mcloudFormName: incoming.mcloudFormName,
		'Lead.LeadSource': incoming['Lead.LeadSource'],
		FormCampaignId: incoming.FormCampaignId,
		DriverCampaignId: incoming.DriverCampaignId,
		requestPage,
		resultPage,
		requestHost
	};

	// console.log(formPostBody);

	const result = request({
		url: sfdcLeadCaptureServlet,
		method: 'POST',
		strictSSL : false,
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		form: formPostBody
	});

};

export = leadCreate;