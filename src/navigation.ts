import { getPermalink } from './utils/permalinks';
import { business } from './config/business';

// Contact hrefs derived from the single source of truth in config/business.ts.
const telHref = `tel:${business.telephone.replace(/\s/g, '')}`;
const emailHref = business.email ? `mailto:${business.email}` : undefined;

const servicesHref = '/#services';
const volunteerHref = '/#volunteer';
const aboutHref = '/#about';
const contactHref = '/#contact';
const jobsHref = '/#jobs';
const donateHref = '/#contact';

export const headerData = {
  links: [
    {
      text: 'Home',
      href: getPermalink('/'),
    },
    {
      text: 'Services',
      mega: {
        items: [
          {
            text: 'Information, Guidance and Advocacy',
            href: servicesHref,
            icon: 'tabler:speakerphone',
            description: 'An advocate on your side for benefits, housing, care and health.',
          },
          {
            text: 'Hate Crime Advocacy',
            href: servicesHref,
            icon: 'tabler:shield-heart',
            description: 'Support to report a disability hate crime and recover afterwards.',
          },
          {
            text: 'Get a Volunteer',
            href: servicesHref,
            icon: 'tabler:users-group',
            description: 'Help with gardening, shopping, walks and a friendly phone call.',
          },
          {
            text: 'Training and Employment',
            href: servicesHref,
            icon: 'tabler:school',
            description: 'Build skills, find better work and get paid what you are worth.',
          },
        ],
        featured: {
          title: 'Not sure what you need?',
          description: 'Tell us what you are dealing with and we will point you the right way. Free and confidential.',
          href: contactHref,
          linkText: 'Talk to us',
          icon: 'tabler:lifebuoy',
        },
      },
    },
    {
      text: 'Volunteer',
      mega: {
        items: [
          {
            text: 'How to Volunteer',
            href: volunteerHref,
            icon: 'tabler:heart-handshake',
            description: 'What is involved, and how to apply in a few minutes.',
          },
          {
            text: 'Gardening Volunteer',
            href: volunteerHref,
            icon: 'tabler:plant-2',
            description: 'Help someone enjoy their own green space again.',
          },
          {
            text: 'Befriender Volunteer',
            href: volunteerHref,
            icon: 'tabler:phone-call',
            description: 'A regular call for someone who might not speak to anyone else.',
          },
          {
            text: 'Shopper or Walking Friend',
            href: volunteerHref,
            icon: 'tabler:walk',
            description: 'Practical help with shopping, or company on a walk.',
          },
        ],
        featured: {
          title: 'A few hours changes someone’s week',
          description: 'No experience needed. Just a bit of time and a willingness to listen.',
          href: contactHref,
          linkText: 'Apply to volunteer',
          icon: 'tabler:sparkles',
        },
      },
    },
    {
      text: 'About Us',
      mega: {
        items: [
          {
            text: 'Our Story',
            href: aboutHref,
            icon: 'tabler:book',
            description: 'Over twenty five years led by disabled people in Hackney.',
          },
          {
            text: 'Staff and Board of Trustees',
            href: aboutHref,
            icon: 'tabler:users',
            description: 'The people behind Choice in Hackney.',
          },
          {
            text: 'Job Board',
            href: jobsHref,
            icon: 'tabler:briefcase',
            description: 'Current vacancies and trustee opportunities.',
          },
          {
            text: 'Contact Us',
            href: contactHref,
            icon: 'tabler:mail',
            description: 'Phone, email and how to find the Marie Lloyd Centre.',
          },
        ],
        featured: {
          title: 'Nothing about us without us',
          description: 'We are run by disabled people, for disabled people, and always have been.',
          href: aboutHref,
          linkText: 'Read our story',
          icon: 'tabler:quote',
        },
      },
    },
    {
      text: 'Contact',
      href: contactHref,
    },
  ],
  actions: [{ variant: 'primary' as const, text: 'Donate', href: donateHref, icon: 'tabler:heart-filled' }],
};

// Footer follows the standing structure: brand column (logo + description +
// legal links), an icon-led "Explore" column, a "Get in touch" column fed by
// config/business.ts, then a bottom bar with the footnote and social icons.
export const footerData = {
  description: business.description,
  links: [
    {
      title: 'Explore',
      links: [
        { text: 'Our services', href: servicesHref, icon: 'tabler:lifebuoy' },
        { text: 'Volunteer with us', href: volunteerHref, icon: 'tabler:heart-handshake' },
        { text: 'Our story', href: aboutHref, icon: 'tabler:users' },
        { text: 'Job board', href: jobsHref, icon: 'tabler:briefcase' },
        { text: 'Donate', href: donateHref, icon: 'tabler:gift' },
      ],
    },
    {
      title: 'Get in touch',
      links: [
        { text: business.telephone, href: telHref, icon: 'tabler:phone' },
        ...(business.email ? [{ text: business.email, href: emailHref, icon: 'tabler:mail' }] : []),
        {
          text: `${business.address.street}, ${business.address.locality} ${business.address.postalCode}`,
          icon: 'tabler:map-pin',
        },
        { text: 'Monday to Friday, 9:30am to 5:00pm', icon: 'tabler:clock' },
      ],
    },
  ],
  secondaryLinks: [{ text: 'Accessibility', href: '/#accessibility' }],
  socialLinks: [
    { ariaLabel: 'Choice in Hackney on X', icon: 'tabler:brand-x', href: 'https://twitter.com/ChoiceinHackney' },
    {
      ariaLabel: 'Choice in Hackney on Facebook',
      icon: 'tabler:brand-facebook',
      href: 'https://www.facebook.com/choiceinhackney',
    },
    {
      ariaLabel: 'Choice in Hackney on LinkedIn',
      icon: 'tabler:brand-linkedin',
      href: 'https://uk.linkedin.com/company/choice-in-hackney',
    },
    ...(emailHref ? [{ ariaLabel: 'Email Choice in Hackney', icon: 'tabler:mail', href: emailHref }] : []),
  ],
  // No Irish tricolour on this build: the client is a London charity, so the
  // flag would read as a claim about them rather than an agency signature.
  footNote: `Registered charity ${business.charityNumber} &middot; Company ${business.companyNumber} &middot; ${business.name}. All rights reserved. Website by <a href="https://designmywebsite.ie" target="_blank" rel="noopener noreferrer" class="hover:underline">Design My Website</a>`,
};
