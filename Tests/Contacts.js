'use strict';

import { Contacts, Permissions } from 'expo';
import * as TestUtils from '../TestUtils';

export const name = 'Contacts';

export function test(t) {
  t.describe('Contacts', () => {
    t.describe('Contacts.getContactsAsync()', () => {
      t.it(
        'gets permission and at least one result, all results of right shape',
        async () => {
          await TestUtils.acceptPermissionsAndRunCommandAsync(() => {
            return Permissions.askAsync(Permissions.CONTACTS);
          });

          let contacts = await Contacts.getContactsAsync({
            fields: [
              Contacts.PHONE_NUMBERS,
              Contacts.EMAILS,
              Contacts.ADDRESSES,
              Contacts.NOTE,
              Contacts.BIRTHDAY,
              Contacts.NON_GREGORIAN_BIRTHDAY,
              Contacts.NAME_PREFIX,
              Contacts.NAME_SUFFIX,
              Contacts.PHONETIC_FIRST_NAME,
              Contacts.PHONETIC_MIDDLE_NAME,
              Contacts.PHONETIC_LAST_NAME,
              Contacts.SOCIAL_PROFILES,
              Contacts.IM_ADDRESSES,
              Contacts.URLS,
              Contacts.DATES,
              Contacts.RELATIONSHIPS,
            ],
            pageSize: 10,
          });
          t.expect(contacts.total > 0).toBe(true);
          t.expect(contacts.data.length > 0).toBe(true);
          contacts.data.forEach((contact) => {
            t
              .expect(typeof contact.id === 'number' || typeof contact.id === 'string')
              .toBe(true);
            t
              .expect(typeof contact.imageAvailable === 'boolean' || typeof contact.imageAvailable === 'undefined')
              .toBe(true);
            const strings = [
              contact.contactType,
              contact.name,
              contact.firstName,
              contact.middleName,
              contact.lastName,
              contact.previousLastName,
              contact.nickname,
              contact.company,
              contact.jobTitle,
              contact.department,
              contact.note,
              contact.namePrefix,
              contact.nameSuffix,
              contact.phoneticFirstName,
              contact.phoneticMiddleName,
              contact.phoneticLastName,
            ];
            strings.forEach(string => {
              t
                .expect(typeof string === 'string' || typeof string === 'undefined')
                .toBe(true);
            });

            const arrays = [
              contact.phoneNumbers,
              contact.emails,
              contact.addresses,
              contact.socialProfiles,
              contact.instantMessageAddresses,
              contact.urls,
              contact.dates,
              contact.relationships
            ];
            arrays.forEach(array => {
              t
                .expect(Array.isArray(array) || typeof array === 'undefined')
                .toBe(true);
            });

            t
              .expect(typeof contact.birthday === 'object' || typeof contact.birthday === 'undefined')
              .toBe(true);
            t
              .expect(typeof contact.nonGregorianBirthday === 'object' || typeof contact.nonGregorianBirthday === 'undefined')
              .toBe(true);
          });
        }
      );

      t.it('skips additional properties if fields is empty', async () => {
        const contacts = await Contacts.getContactsAsync({
          fields: [],
        });
        t.expect(contacts.total > 0).toBe(true);
        t.expect(contacts.data.length > 0).toBe(true);
        contacts.data.forEach((contact) => {
          const toSkip = [
            contact.phoneNumbers,
            contact.emails,
            contact.addresses,
            contact.socialProfiles,
            contact.instantMessageAddresses,
            contact.urls,
            contact.dates,
            contact.relationships,
            contact.note,
            contact.namePrefix,
            contact.nameSuffix,
            contact.phoneticFirstName,
            contact.phoneticMiddleName,
            contact.phoneticLastName,
          ];
          toSkip.forEach((entry) => {
            t
              .expect(typeof entry === 'undefined')
              .toBe(true);
          });
        });
      });

      t.it('returns consistent image data', async () => {
        const contacts = await Contacts.getContactsAsync({
          fields: [Contacts.IMAGE, Contacts.THUMBNAIL],
        });
        if (contacts.total > 0) {
          contacts.data.forEach((contact) => {
            if (contact.imageAvailable) {
              t.expect(typeof contact.thumbnail === 'object').toBe(true);
              t.expect(typeof contact.thumbnail.uri === 'string').toBe(true);
              t.expect(typeof contact.image === 'object' || typeof contact.image === 'undefined');
              if (contact.image) {
                t.expect(typeof contact.image.uri === 'string').toBe(true);
              }
            } else {
              t.expect(contact.thumbnail.uri).toBe(null);
              if (contact.image) {
                t.expect(contact.image.uri).toBe(null);
              }
            }
          })
        }
      });

      t.it('respects the page size', async () => {
        const contacts = await Contacts.getContactsAsync({
          fields: [Contacts.PHONE_NUMBERS],
          pageOffset: 0,
          pageSize: 2,
        });
        if (contacts.total >= 2) {
          t.expect(contacts.data.length).toBe(2);
        }
      });

      t.it('respects the page offset', async () => {
        const firstPage = await Contacts.getContactsAsync({
          fields: [Contacts.PHONE_NUMBERS],
          pageOffset: 0,
          pageSize: 2,
        });
        const secondPage = await Contacts.getContactsAsync({
          fields: [Contacts.PHONE_NUMBERS],
          pageOffset: 1,
          pageSize: 2,
        });

        if (firstPage.total >= 3) {
          t.expect(firstPage.data.length).toBe(2);
          t.expect(secondPage.data.length).toBe(2);
          t.expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
          t.expect(firstPage.data[1].id).not.toBe(secondPage.data[1].id);
          t.expect(firstPage.data[1].id).toBe(secondPage.data[0].id);
        }
      });

      t.it('gets right single contact', async () => {
        const contacts = await Contacts.getContactsAsync();
        if (contacts.total > 0) {
          const firstContactId = contacts.data[0].id;
          const contact = await Contacts.getContactByIdAsync({id: firstContactId});
          t.expect(contact.id === firstContactId).toBe(true);
        }
      });
    });
  });
}
