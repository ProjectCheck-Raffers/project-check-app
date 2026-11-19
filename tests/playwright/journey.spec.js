const {test}=require('@playwright/test');
const currentCustomerJourney=require('./current-customer-journey');
test('current customer journey preserves project facts and saves Site Layout',currentCustomerJourney);
