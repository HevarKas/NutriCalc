/**
 * Nutrition Calculator Module
 *
 * Provides personalized nutrition calculations and meal plans based on user inputs
 * Uses Mifflin-St Jeor equation for BMR calculation and evidence-based macronutrient distributions
 */

class NutritionCalculator {
  constructor() {
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    document
      .getElementById("nutrition-form")
      .addEventListener("submit", this.handleFormSubmit.bind(this));
  }

  async handleFormSubmit(event) {
    event.preventDefault();

    try {
      // Clear previous error message
      this.clearError();

      const userInputs = this.validateInputs();
      const { dailyCalories, macros } =
        this.calculateNutritionalNeeds(userInputs);

      this.displayNutritionResults(macros);
      await this.generateMealPlan(dailyCalories, macros);
    } catch (error) {
      console.error("Nutrition calculation error:", error);
      this.showFormError(
        error.message || "An error occurred. Please try again."
      );
    }
  }

  // Show error message in the form
  showFormError(message) {
    const errorDiv = document.getElementById("form-error");
    errorDiv.textContent = message;
    errorDiv.classList.remove("hidden");
  }

  // Clear error when form is valid
  clearError() {
    const errorDiv = document.getElementById("form-error");
    errorDiv.textContent = "";
    errorDiv.classList.add("hidden");
  }

  validateInputs() {
    const getElementValue = (id) => document.getElementById(id).value;
    const getNumericValue = (id) => parseFloat(getElementValue(id));

    const age = getNumericValue("age");
    const weight = getNumericValue("weight");
    const height = getNumericValue("height");
    const gender = getElementValue("gender");
    const activityLevel = getElementValue("activity");
    const goal = getElementValue("goal");

    // Input validation
    const validations = [
      {
        condition: isNaN(age) || age < 15 || age > 120,
        message: "Please enter a valid age (15-120)",
      },
      {
        condition: isNaN(weight) || weight < 30 || weight > 300,
        message: "Please enter a valid weight (30-300 kg)",
      },
      {
        condition: isNaN(height) || height < 100 || height > 250,
        message: "Please enter a valid height (100-250 cm)",
      },
      {
        condition: !["male", "female"].includes(gender),
        message: "Invalid gender selection",
      },
      {
        condition: !["low", "moderate", "high"].includes(activityLevel),
        message: "Invalid activity level",
      },
      {
        condition: !["maintain", "lose", "gain"].includes(goal),
        message: "Invalid goal selection",
      },
    ];

    for (const validation of validations) {
      if (validation.condition) {
        throw new Error(validation.message);
      }
    }

    return { age, weight, height, gender, activityLevel, goal };
  }

  calculateNutritionalNeeds(userData) {
    const { age, weight, height, gender, activityLevel, goal } = userData;

    // Calculate BMR using Mifflin-St Jeor Equation
    const bmr = this.calculateBMR(weight, height, age, gender);
    const dailyCalories = this.calculateDailyCalories(bmr, activityLevel, goal);
    const macros = this.calculateMacronutrients(dailyCalories, weight, gender);

    return { bmr, dailyCalories, macros };
  }

  calculateBMR(weight, height, age, gender) {
    return gender === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
  }

  calculateDailyCalories(bmr, activityLevel, goal) {
    const ACTIVITY_MULTIPLIERS = {
      low: 1.4, // Sedentary
      moderate: 1.7, // Moderately active
      high: 2.0, // Very active
    };

    let calories = bmr * ACTIVITY_MULTIPLIERS[activityLevel];

    // Adjust for goals
    switch (goal) {
      case "lose":
        calories = Math.max(bmr * 0.8, calories - 300);
        break;
      case "gain":
        calories += 300;
        break;
      // "maintain" needs no adjustment
    }

    return calories;
  }

  calculateMacronutrients(dailyCalories, weight, gender) {
    return {
      calories: this.createRange(dailyCalories, 0.9, 1.1, "kcal"),
      protein: this.createRange(weight * 1.6, 1, 1.375), // 1.6-2.2g/kg
      carbs: this.createRange((dailyCalories * 0.4) / 4, 1, 1.5), // 40-60% of calories
      fat: this.createRange((dailyCalories * 0.2) / 9, 1, 1.75), // 20-35% of calories
      sugar: { min: 0, max: Math.round((dailyCalories * 0.05) / 4) }, // <5% of calories
    };
  }

  createRange(baseValue, minMultiplier, maxMultiplier, unit = "g") {
    return {
      min: Math.round(baseValue * minMultiplier),
      max: Math.round(baseValue * maxMultiplier),
      unit,
    };
  }

  displayNutritionResults(macros) {
    const resultContainer = document.getElementById("needs-output");
    const dailyNeedsContainer = document.getElementById("daily-needs");

    dailyNeedsContainer.classList.remove("hidden");

    resultContainer.innerHTML = `
        <ul class="macros-list">
          ${Object.entries(macros)
            .map(
              ([key, { min, max, unit = "g" }]) => `
            <li>
              <strong>${this.capitalizeFirstLetter(key)}:</strong> 
              ${min}${unit} – ${max}${unit}
            </li>
          `
            )
            .join("")}
        </ul>
    `;

    // Store for potential later use
    window.userNutritionRange = macros;
  }

  async generateMealPlan(dailyCalories, macros) {
    const MEAL_CATEGORIES = [
      "breakfast",
      "fruit",
      "salad",
      "lunch",
      "snacks",
      "dinner",
    ];
    const MEAL_DISTRIBUTION = {
      breakfast: 0.25,
      fruit: 0.05,
      salad: 0.15, // Increased for more vegetables
      lunch: 0.25, // Reduced from 0.3
      snacks: 0.15, // Increased
      dinner: 0.15, // Reduced
    };

    const PORTION_LIMITS = {
      breakfast: { min: 50, max: 500 },
      fruit: { min: 50, max: 300 },
      salad: { min: 50, max: 400 },
      lunch: { min: 100, max: 600 },
      snacks: { min: 30, max: 300 },
      dinner: { min: 100, max: 600 },
    };

    try {
      const foodData = await this.loadFoodData(MEAL_CATEGORIES);
      const mealTargets = this.calculateMealTargets(
        MEAL_DISTRIBUTION,
        dailyCalories,
        macros
      );

      this.displayMealPlan(foodData, mealTargets, PORTION_LIMITS);
    } catch (error) {
      throw new Error(`Meal plan generation failed: ${error.message}`);
    }
  }

  async loadFoodData(categories) {
    const foodData = {};

    await Promise.all(
      categories.map(async (category) => {
        const response = await fetch(`../db/${category}.json`);
        if (!response.ok) throw new Error(`Failed to load ${category} data`);
        foodData[category] = await response.json();
      })
    );

    return foodData;
  }

  calculateMealTargets(distribution, dailyCalories, macros) {
    const targets = {};

    for (const [meal, percentage] of Object.entries(distribution)) {
      targets[meal] = {
        calories: Math.round(dailyCalories * percentage),
        protein: Math.round(macros.protein.max * percentage),
        carbs: Math.round(macros.carbs.max * percentage),
        fat: Math.round(macros.fat.max * percentage),
        sugar: Math.round(macros.sugar.max * percentage),
      };
    }

    return targets;
  }

  displayMealPlan(foodData, mealTargets, portionLimits) {
    const outputDiv = document.getElementById("food-output");
    const outputContainer = document.getElementById("food-plan");
    const backButton = document.getElementById("back-button");

    backButton.classList.remove("hidden");
    outputContainer.classList.remove("hidden");
    document.getElementById("user-input").classList.add("hidden");

    outputDiv.innerHTML = "<h2>🍽️ Personalized Daily Meal Plan</h2>";

    for (const [category, foods] of Object.entries(foodData)) {
      const targets = mealTargets[category];
      const limits = portionLimits[category];

      const suitableFoods = foods.filter((food) =>
        this.isFoodSuitable(food, targets, limits)
      );

      if (suitableFoods.length > 0) {
        outputDiv.innerHTML += this.createMealTable(
          this.capitalizeFirstLetter(category),
          suitableFoods,
          targets,
          limits
        );
      }
    }
  }

  isFoodSuitable(food, targets, limits) {
    const gram = food.gram ?? 100;

    // Calculate portion based on protein target
    const proteinPerGram = food.protein / gram;
    let portion = Math.round(targets.protein / proteinPerGram);

    // Adjust portion to stay within limits
    portion = Math.min(Math.max(portion, limits.min), limits.max);

    // Calculate actual nutrients for this portion
    const actualCalories = Math.round((food.calories / gram) * portion);
    const actualSugar = Math.round((food.sugar / gram) * portion);

    // More flexible calorie check (60-140% of target)
    const isCalorieSuitable =
      actualCalories >= targets.calories * 0.6 &&
      actualCalories <= targets.calories * 1.4;

    // Sugar check (up to 150% of target)
    const isSugarSuitable = actualSugar <= targets.sugar * 1.5;

    return isCalorieSuitable && isSugarSuitable;
  }

  createMealTable(mealLabel, foods, targets, limits) {
    return `
      <div class="meal-section">
        <h3>${mealLabel}</h3>
        <p class="meal-targets">
          <em>Target: ${targets.calories} kcal | Protein: ${targets.protein}g | 
          Carbs: ${targets.carbs}g | Fat: ${targets.fat}g</em>
        </p>
        
        <table class="meal-table">
          <thead>
            <tr>
              <th>Food</th>
              <th>Portion</th>
              <th>Calories</th>
              <th>Protein</th>
              <th>Carbs</th>
              <th>Fat</th>
              <th>Sugar</th>
            </tr>
          </thead>
          <tbody>
            ${foods
              .map((food) => this.createFoodRow(food, limits, targets.protein))
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  createFoodRow(food, limits, proteinTarget) {
    const gram = food.gram ?? 100;
    const portion = Math.min(
      Math.max(Math.round(proteinTarget / (food.protein / gram)), limits.min),
      limits.max
    );

    return `
      <tr>
        <td>${food.name}</td>
        <td>${portion}g</td>
        <td>${Math.round((food.calories / gram) * portion)}</td>
        <td>${Math.round((food.protein / gram) * portion)}</td>
        <td>${Math.round((food.carbs / gram) * portion)}</td>
        <td>${Math.round((food.fat / gram) * portion)}</td>
        <td>${Math.round((food.sugar / gram) * portion)}</td>
      </tr>
    `;
  }

  displayError(message) {
    document.getElementById("food-output").innerHTML = `
      <p class="error">${message}</p>
    `;
  }

  capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}

// Initialize the calculator when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new NutritionCalculator();
});

// back button functionality
document.getElementById("back-button").addEventListener("click", () => {
  document.getElementById("food-plan").classList.add("hidden");
  document.getElementById("daily-needs").classList.add("hidden");
  document.getElementById("user-input").classList.remove("hidden");
  document.getElementById("back-button").classList.add("hidden");
  document.getElementById("food-output").innerHTML = "";
});
