const {test}=require('@playwright/test');
const currentCustomerJourney=require('./current-customer-journey');
test('current customer journey parity through saved Site Layout',currentCustomerJourney);
