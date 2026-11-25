> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved).

# Customer questions and fields

## Existing base and intention

**What is already on the area where the building will go, and do you intend to use it as the base for the new building?**

**What is there?** Concrete slab / Tarmac or asphalt / Hardcore or stone / Soil or grass / Existing foundations / Existing building / Mixed / Not sure.

**Do you intend to use it?** Yes / No / Not sure.

Capture `existing_base` and `intends_to_reuse_existing_base` separately. Carry `base_suitability_status` and `anchoring_suitability_status` as separate assessment fields.

## Temperature and insulation

**What temperature conditions will the building need?**

- Heated working environment
- Unheated ambient storage
- Other temperature requirement — enter °C

Capture `temperature_requirement` and collect `required_temperature_c` for Other. Record `insulated_envelope_required` and `specialist_low_temperature_flag` as report assessments. Ask about use and temperature. The report team assesses insulation.
