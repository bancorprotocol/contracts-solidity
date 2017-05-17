/* global artifacts, contract, it, assert */
/* eslint-disable prefer-reflect */

const BancorEventsDispatcher = artifacts.require('BancorEventsDispatcher.sol');
const utils = require('./helpers/Utils');

const eventsAddress1 = '0x32f0f93396f0865d7ce412695beb3c3ad9ccca75';
const eventsAddress2 = '0x3f1a081f8b6093f480cb789f99903da4e87afaa1';

contract('BancorEventsDispatcher', (accounts) => {
    it('verifies construction with events contract', async () => {
        let dispatcher = await BancorEventsDispatcher.new(eventsAddress1);
        let events = await dispatcher.events.call();
        assert.equal(events, eventsAddress1);
    });

    it('verifies construction without events contract', async () => {
        let dispatcher = await BancorEventsDispatcher.new();
        let events = await dispatcher.events.call();
        assert.equal(events, utils.zeroAddress);
    });

    it('verifies the owner can change the events contract address', async () => {
        let dispatcher = await BancorEventsDispatcher.new(eventsAddress1);
        await dispatcher.setEvents(eventsAddress2);
        let events = await dispatcher.events.call();
        assert.equal(events, eventsAddress2);
    });

    it('verifies the owner can remove the events contract address', async () => {
        let dispatcher = await BancorEventsDispatcher.new(eventsAddress1);
        await dispatcher.setEvents('0x0');
        let events = await dispatcher.events.call();
        assert.equal(events, utils.zeroAddress);
    });

    it('verifies that only the owner can set the events contract address', async () => {
        let dispatcher = await BancorEventsDispatcher.new(eventsAddress1);

        try {
            await dispatcher.setEvents(eventsAddress2, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
