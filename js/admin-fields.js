/* Shared explanations for owner-facing fields. No business values are changed. */
(function(){
  'use strict';
  var help = {
    'Remove':'Hide this element for visitors after publishing. Restore or Undo brings it back without losing its content.',
    'Restore':'Show this element again. Publish when you are ready for visitors to see it.',
    'Website name':'The business name shown in the website header and other shared contact areas.',
    'Contact email':'The public address visitors can contact. New-enquiry notification recipients are managed separately in Enquiry emails.',
    'Phone':'The number visitors see and call when they tap a phone link. Include the country code.',
    'Street address':'The first line of your public business address, such as the street and building number.',
    'City and country':'The remaining public address: city, region, postal code and country as needed.',
    'LinkedIn page':'The full link to your company LinkedIn page. Leave blank to remove this destination.',
    'LinkedIn URL (HTTPS)':'The full, secure link to this team member’s public LinkedIn profile. Leave blank if no profile should be linked.',
    'Website language':'The starting language for new visitors. Visitors can still switch languages; returning visitors keep their choice.',
    'Privacy policy':'The full link to your published privacy policy. Leaving it blank leaves visitors without a policy link.',
    'Terms':'The full link to your terms page. Leaving it blank leaves visitors without a terms link.',
    'Appointment booking':'The full booking link for consultation buttons. Leave blank to use the website contact flow.',
    'Current password':'Enter the password you use to sign in, to confirm this account change.',
    'New password (8+ characters)':'Choose a new sign-in password of at least eight characters. Your other sessions will be signed out.',
    'Repeat new password':'Type the same new password again to catch typing mistakes.',
    'Recovery email':'Your private account email for password reset links and sign-in when the website has multiple users. Saving takes effect immediately.',
    'Add recipient':'Add a team member who should receive new enquiries, then select Save recipients. This address is not shown on the website.',
    'Browser / search title':'The title used in browser tabs and search previews. Leave blank to keep the page default; search engines may display different wording.',
    'Search title':'The title used in search previews for this item. Leave blank to use its existing title.',
    'Meta description':'A short summary for search and sharing previews. It does not replace the visible page text. Leave blank to use the default summary.',
    'Social image URL or media ID':'The image shown when this page is shared. Choose an image from the library, or paste a full image link. Leave blank to use the default.',
    'Slug':'The last part of this item’s web address. Use a short, unique name. Changing it after publication can break previously shared links.',
    'URL slug':'The last part of this item’s web address. Changing it after publication can break previously shared links.',
    'Sector key':'The category used to group this case study, such as technology or retail. Use the same category spelling for related cases.',
    'Client':'The client name shown with this case study. Publish only an approved name.',
    'Year':'The year this project or result relates to; it is shown with the case study.',
    'Category':'The topic used to group this article in the Insights listing.',
    'Author':'The author credited on the article and in its search information.',
    'Date':'The publication date shown with the article. This does not schedule publication; Publish controls when it goes live.',
    'Reading minutes':'The estimated reading time shown to readers, in minutes.',
    'Location':'Where this job is based, such as Baku, Azerbaijan. Mark the role as remote separately when applicable.',
    'Employment type':'Whether this is a full-time, part-time or contract position. Shown with the job details.',
    'Apply URL (HTTPS)':'The secure web address opened by Apply. Use the application form for this specific job.',
    'Valid through':'The application closing date included in job search information. This does not automatically unpublish the job.',
    'Metric value':'The approved result to show, such as 35% or 2.4×. This is display text, not an automatically calculated value.',
    'File name':'A label for finding this image in the library. It does not change the page heading.',
    'Alt text':'Describe the useful content of the image for people who cannot see it. Avoid file names and phrases such as “image of”.',
    'Image description':'Describe the useful content of the image for people who cannot see it. Avoid file names and phrases such as “image of”.',
    'This role is remote':'Indicates that this job can be done remotely. The location field still describes the relevant location or hiring region.'
  };
  var paths={siteName:'Website name',email:'Contact email',phone:'Phone',addressLine1:'Street address',addressLine2:'City and country',linkedin:'LinkedIn page',defaultLang:'Website language',privacyUrl:'Privacy policy',termsUrl:'Terms',schedulerUrl:'Appointment booking'};
  var serial=0;
  function enhance(root){
    root.querySelectorAll('input,select,textarea').forEach(function(input){
      if(input.type==='hidden'||input.hasAttribute('data-field-explained'))return;
      var binding=(input.getAttribute('data-bind')||'').replace(/^settings\./,''),label=input.labels&&input.labels[0];
      if(!label){var field=input.closest('.field,.omni-field,.omni-setting');label=field&&field.querySelector('label');if(label){if(!input.id)input.id='omniField'+(++serial);label.htmlFor=input.id;}}
      var name=paths[binding]||(label&&label.textContent.trim())||input.getAttribute('aria-label')||'',text=help[name];
      var byId={omniInviteName:'The name shown to the team alongside this person’s changes.',omniInviteEmail:'The private email address that receives the invitation and is used to sign in.',omniInviteRole:'Editor can edit content, manage images and publish. Admin can also manage website settings, accounts and user access.'};
      text=byId[input.id]||text;
      if(!text&&/^Metric label/.test(name))text='Explain what this result measures in the selected language, such as “increase in qualified leads”.';
      if(!text)return;
      if(!input.id)input.id='omniField'+(++serial);
      var small=document.createElement('small');small.id=input.id+'-explanation';small.className='omni-field-help';small.textContent=text;
      var anchor=input.closest('.omni-password,.omni-add-row,.omni-metric-row')||input;anchor.insertAdjacentElement('afterend',small);
      input.setAttribute('aria-describedby',((input.getAttribute('aria-describedby')||'')+' '+small.id).trim());input.setAttribute('data-field-explained','');
    });
  }
  window.OmniFieldHelp={enhance:enhance};
})();
